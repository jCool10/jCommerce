import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/index.js';
import type { Currency as PrismaCurrency } from '../../generated/prisma/index.js';
import type { Currency } from '@jcool/contracts';
import { Product } from '../../domain/product.entity.js';
import { Sku } from '../../domain/sku.entity.js';
import { SkuPrice } from '../../domain/sku-price.entity.js';
import type {
  ProductListCursor,
  ProductListFilter,
  ProductListPage,
  ProductRepository,
} from '../../domain/ports/product.repository.js';
import type { OutboxAppend } from '../../domain/ports/outbox.repository.js';
import { PrismaService } from './prisma.service.js';

type ProductRow = Prisma.ProductGetPayload<{
  include: { skus: { include: { prices: true } } };
}>;

const toCurrency = (c: PrismaCurrency): Currency => c as Currency;

const toDomain = (row: ProductRow): Product =>
  Product.rehydrate({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    images: row.images,
    isActive: row.isActive,
    skus: row.skus.map((s) =>
      Sku.rehydrate({
        id: s.id,
        productId: s.productId,
        sku: s.sku,
        attributes: (s.attributes as Record<string, string>) ?? {},
        prices: s.prices.map((p) =>
          SkuPrice.rehydrate({
            skuId: p.skuId,
            currency: toCurrency(p.currency),
            unitAmount: p.unitAmount,
          }),
        ),
      }),
    ),
  });

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { skus: { include: { prices: true } } },
    });
    return row ? toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({
      where: { slug },
      include: { skus: { include: { prices: true } } },
    });
    return row ? toDomain(row) : null;
  }

  async list(filter: ProductListFilter, page: ProductListCursor): Promise<ProductListPage> {
    const where: Prisma.ProductWhereInput = {};
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.search)
      where.name = { contains: filter.search, mode: 'insensitive' as const };

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: { id: 'asc' },
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      include: { skus: { include: { prices: true } } },
    });

    const hasNext = rows.length > page.limit;
    const slice = hasNext ? rows.slice(0, page.limit) : rows;
    return {
      items: slice.map(toDomain),
      nextCursor: hasNext ? (slice.at(-1)?.id ?? null) : null,
    };
  }

  async save(product: Product, outboxEvents: OutboxAppend[] = []): Promise<Product> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id: product.id },
        select: { id: true, skus: { select: { id: true } } },
      });

      if (!existing) {
        // INSERT path: fresh product, no prior SKUs/inventory to preserve.
        await tx.product.create({
          data: {
            id: product.id,
            slug: product.slug,
            name: product.name,
            description: product.description,
            categoryId: product.categoryId,
            images: product.images,
            isActive: product.isActive,
            skus: {
              create: product.skus.map((sku) => ({
                id: sku.id,
                sku: sku.code,
                attributes: sku.attributes as Prisma.InputJsonValue,
                prices: {
                  create: sku.prices.map((p) => ({
                    currency: p.currency as PrismaCurrency,
                    unitAmount: p.unitAmount,
                  })),
                },
              })),
            },
          },
        });
      } else {
        // UPDATE path: per-SKU diff so Inventory rows survive.
        await tx.product.update({
          where: { id: product.id },
          data: {
            slug: product.slug,
            name: product.name,
            description: product.description,
            categoryId: product.categoryId,
            images: product.images,
            isActive: product.isActive,
          },
        });

        const incomingIds = new Set(product.skus.map((s) => s.id));
        const toDelete = existing.skus
          .map((s) => s.id)
          .filter((id) => !incomingIds.has(id));
        if (toDelete.length > 0) {
          // Cascades to SkuPrice + Inventory (intentional for removed SKUs).
          await tx.sku.deleteMany({ where: { id: { in: toDelete } } });
        }

        for (const sku of product.skus) {
          await tx.sku.upsert({
            where: { id: sku.id },
            create: {
              id: sku.id,
              productId: product.id,
              sku: sku.code,
              attributes: sku.attributes as Prisma.InputJsonValue,
            },
            update: {
              sku: sku.code,
              attributes: sku.attributes as Prisma.InputJsonValue,
            },
          });
          // Prices: simplest correct strategy — replace rows for this SKU.
          // Inventory is NOT touched.
          await tx.skuPrice.deleteMany({ where: { skuId: sku.id } });
          if (sku.prices.length > 0) {
            await tx.skuPrice.createMany({
              data: sku.prices.map((p) => ({
                skuId: sku.id,
                currency: p.currency as PrismaCurrency,
                unitAmount: p.unitAmount,
              })),
            });
          }
        }
      }

      if (outboxEvents.length > 0) {
        await tx.outboxEvent.createMany({
          data: outboxEvents.map((e) => ({
            routingKey: e.routingKey,
            payload: e.payload as Prisma.InputJsonValue,
          })),
        });
      }

      const fresh = await tx.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { skus: { include: { prices: true } } },
      });
      return toDomain(fresh);
    });
  }

  async saveMetadata(product: Product, outboxEvents: OutboxAppend[] = []): Promise<Product> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: product.id },
        data: {
          slug: product.slug,
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          images: product.images,
          isActive: product.isActive,
        },
        include: { skus: { include: { prices: true } } },
      });

      if (outboxEvents.length > 0) {
        await tx.outboxEvent.createMany({
          data: outboxEvents.map((e) => ({
            routingKey: e.routingKey,
            payload: e.payload as Prisma.InputJsonValue,
          })),
        });
      }
      return toDomain(updated);
    });
  }

  async delete(id: string, outboxEvents: OutboxAppend[] = []): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      if (outboxEvents.length > 0) {
        await tx.outboxEvent.createMany({
          data: outboxEvents.map((e) => ({
            routingKey: e.routingKey,
            payload: e.payload as Prisma.InputJsonValue,
          })),
        });
      }
    });
  }
}
