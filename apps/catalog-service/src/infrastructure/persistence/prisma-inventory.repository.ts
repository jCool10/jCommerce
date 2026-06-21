import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import { Inventory } from '../../domain/inventory.entity.js';
import type {
  InventoryRepository,
  ReservationOutcome,
  ReserveLine,
} from '../../domain/ports/inventory.repository.js';
import { PrismaService } from './prisma.service.js';

interface InventoryRow {
  sku_id: string;
  available: number;
  reserved: number;
}

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySkuId(skuId: string): Promise<Inventory | null> {
    const row = await this.prisma.inventory.findUnique({ where: { skuId } });
    return row
      ? Inventory.rehydrate({ skuId: row.skuId, available: row.available, reserved: row.reserved })
      : null;
  }

  async findBySkuIds(skuIds: string[]): Promise<Inventory[]> {
    if (skuIds.length === 0) return [];
    const rows = await this.prisma.inventory.findMany({ where: { skuId: { in: skuIds } } });
    return rows.map((r) =>
      Inventory.rehydrate({ skuId: r.skuId, available: r.available, reserved: r.reserved }),
    );
  }

  async upsertMany(records: Inventory[]): Promise<void> {
    if (records.length === 0) return;
    await this.prisma.$transaction(
      records.map((r) =>
        this.prisma.inventory.upsert({
          where: { skuId: r.skuId },
          update: { available: r.available, reserved: r.reserved },
          create: { skuId: r.skuId, available: r.available, reserved: r.reserved },
        }),
      ),
    );
  }

  /**
   * Atomic multi-SKU reservation:
   *
   *  1. SELECT … FOR UPDATE ordered by sku_id (sorted) → no deadlock between
   *     concurrent transactions that touch overlapping SKU sets.
   *  2. Verify each line has available stock.
   *  3. If ANY line short → return insufficient list, no writes.
   *  4. Otherwise UPDATE inventory rows + INSERT reservations.
   *
   * Idempotency: `reservations` has a unique (orderId, skuId) constraint and
   * a quick pre-check returns the prior outcome for a re-tried orderId.
   */
  async reserveWithLock(orderId: string, lines: ReserveLine[]): Promise<ReservationOutcome> {
    if (lines.length === 0) {
      return { reservedSkuIds: [], insufficientStock: [] };
    }
    const sortedLines = [...lines].sort((a, b) => a.skuId.localeCompare(b.skuId));
    const skuIds = sortedLines.map((l) => l.skuId);

    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.reservation.findMany({ where: { orderId } });
      if (prior.length > 0) {
        return {
          reservedSkuIds: prior.map((r) => r.skuId),
          insufficientStock: [],
        };
      }

      // Lock the inventory rows in sorted order via raw query.
      const idsList = Prisma.join(skuIds);
      const locked = await tx.$queryRaw<InventoryRow[]>`
        SELECT sku_id, available, reserved
          FROM inventory
         WHERE sku_id IN (${idsList})
         ORDER BY sku_id ASC
         FOR UPDATE
      `;
      const lockedBySkuId = new Map(locked.map((r) => [r.sku_id, r]));

      const insufficient: ReservationOutcome['insufficientStock'] = [];
      for (const line of sortedLines) {
        const row = lockedBySkuId.get(line.skuId);
        const available = row?.available ?? 0;
        if (available < line.quantity) {
          insufficient.push({
            skuId: line.skuId,
            requested: line.quantity,
            available,
          });
        }
      }

      if (insufficient.length > 0) {
        return { reservedSkuIds: [], insufficientStock: insufficient };
      }

      for (const line of sortedLines) {
        await tx.inventory.update({
          where: { skuId: line.skuId },
          data: {
            available: { decrement: line.quantity },
            reserved: { increment: line.quantity },
          },
        });
      }

      await tx.reservation.createMany({
        data: sortedLines.map((l) => ({
          orderId,
          skuId: l.skuId,
          quantity: l.quantity,
        })),
      });

      return {
        reservedSkuIds: sortedLines.map((l) => l.skuId),
        insufficientStock: [],
      };
    });
  }

  async releaseForOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reservations = await tx.reservation.findMany({ where: { orderId } });
      if (reservations.length === 0) return; // idempotent

      for (const r of reservations) {
        await tx.inventory.update({
          where: { skuId: r.skuId },
          data: {
            available: { increment: r.quantity },
            reserved: { decrement: r.quantity },
          },
        });
      }
      await tx.reservation.deleteMany({ where: { orderId } });
    });
  }
}
