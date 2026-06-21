import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import type { Currency as PrismaCurrency, OrderStatus as PrismaOrderStatus } from '../../generated/prisma/index.js';
import type { Currency, OrderCancelReason, OrderStatus } from '@jcool/contracts';
import { Order } from '../../domain/order.entity.js';
import { OrderItem } from '../../domain/order-item.entity.js';
import type {
  OrderEventAppend,
  OrderListCursor,
  OrderListFilter,
  OrderListPage,
  OrderRepository,
  OrphanReservationCandidate,
  OutboxAppend,
} from '../../domain/ports/order.repository.js';
import { PrismaService } from './prisma.service.js';

type OrderRow = Prisma.OrderGetPayload<{ include: { items: true } }>;

const toCurrency = (c: PrismaCurrency): Currency => c as Currency;
const toStatus = (s: PrismaOrderStatus): OrderStatus => s as OrderStatus;

const toDomain = (row: OrderRow): Order =>
  Order.rehydrate({
    id: row.id,
    userId: row.userId,
    status: toStatus(row.status),
    items: row.items.map((i) =>
      OrderItem.rehydrate({
        id: i.id,
        orderId: i.orderId,
        skuId: i.skuId,
        quantity: i.quantity,
        unitAmount: i.unitAmount,
        currency: toCurrency(i.currency),
      }),
    ),
    totalAmount: row.totalAmount,
    currency: toCurrency(row.currency),
    stripePaymentIntentId: row.stripePaymentIntentId,
    shippingAddress: {
      line1: row.shippingLine1,
      line2: row.shippingLine2 ?? undefined,
      city: row.shippingCity,
      region: row.shippingRegion ?? undefined,
      postalCode: row.shippingPostalCode,
      country: row.shippingCountry,
    },
    cancelReason: (row.cancelReason as OrderCancelReason | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

// Stable 64-bit signed integer hash → pg_advisory_xact_lock(bigint).
// FNV-1a 64-bit fold into JS Number bounds; collisions are acceptable because
// advisory locks are advisory — concurrent transactions for the SAME orderId
// always hash equal (correctness preserved); rare cross-order collisions only
// cause harmless serialisation.
const lockKeyFor = (orderId: string): bigint => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const ch of orderId) {
    hash ^= BigInt(ch.charCodeAt(0));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  // Two's-complement signed bigint for Postgres int8.
  return hash > 0x7fffffffffffffffn ? hash - 0x10000000000000000n : hash;
};

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? toDomain(row) : null;
  }

  async findByStripePaymentIntentId(piid: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { stripePaymentIntentId: piid },
      include: { items: true },
    });
    return row ? toDomain(row) : null;
  }

  async list(filter: OrderListFilter, page: OrderListCursor): Promise<OrderListPage> {
    const where: Prisma.OrderWhereInput = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.status) where.status = filter.status as PrismaOrderStatus;

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { id: 'asc' },
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      include: { items: true },
    });
    const hasNext = rows.length > page.limit;
    const slice = hasNext ? rows.slice(0, page.limit) : rows;
    return {
      items: slice.map(toDomain),
      nextCursor: hasNext ? (slice.at(-1)?.id ?? null) : null,
    };
  }

  async save(
    order: Order,
    outbox: OutboxAppend[] = [],
    audit: OrderEventAppend[] = [],
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: order.id },
        select: { id: true },
      });

      if (!existing) {
        await tx.order.create({
          data: {
            id: order.id,
            userId: order.userId,
            status: order.status as PrismaOrderStatus,
            totalAmount: order.totalAmount,
            currency: order.currency as PrismaCurrency,
            stripePaymentIntentId: order.stripePaymentIntentId,
            shippingLine1: order.shippingAddress.line1,
            shippingLine2: order.shippingAddress.line2 ?? null,
            shippingCity: order.shippingAddress.city,
            shippingRegion: order.shippingAddress.region ?? null,
            shippingPostalCode: order.shippingAddress.postalCode,
            shippingCountry: order.shippingAddress.country,
            cancelReason: order.cancelReason,
            items: {
              create: order.items.map((i) => ({
                id: i.id,
                skuId: i.skuId,
                quantity: i.quantity,
                unitAmount: i.unitAmount,
                currency: i.currency as PrismaCurrency,
              })),
            },
          },
        });
      } else {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: order.status as PrismaOrderStatus,
            stripePaymentIntentId: order.stripePaymentIntentId,
            cancelReason: order.cancelReason,
          },
        });
      }

      if (outbox.length > 0) {
        await tx.outboxEvent.createMany({
          data: outbox.map((e) => ({
            routingKey: e.routingKey,
            payload: e.payload as Prisma.InputJsonValue,
          })),
        });
      }

      if (audit.length > 0) {
        await tx.orderEvent.createMany({
          data: audit.map((a) => ({
            orderId: order.id,
            type: a.type,
            payload: a.payload as Prisma.InputJsonValue,
          })),
        });
      }

      const fresh = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      return toDomain(fresh);
    });
  }

  /**
   * Serialises state transitions for the same orderId via
   * `pg_advisory_xact_lock(bigint)`. Mutual-exclusion semantics:
   *
   *   1. Outer transaction tx_A acquires the advisory lock.
   *   2. `task()` runs INSIDE tx_A's await chain. Its `findById` reads via
   *      the default Prisma client (separate tx_B); however because tx_A
   *      still holds the advisory lock, no other caller can enter this
   *      same critical section concurrently.
   *   3. `task()`'s `save()` opens its own $transaction tx_C. tx_C commits
   *      its writes; tx_A then commits, releasing the advisory lock.
   *
   * Therefore the find+save sequence is serialised with respect to OTHER
   * advisory-lock holders for the same orderId — which is the invariant we
   * need. The cost is two Postgres connections per saga step (tx_A + tx_C);
   * a single threaded-tx implementation would halve the pool footprint.
   *
   * Different orderIds hash to different lock keys → no false serialisation.
   */
  async withAdvisoryLock<T>(orderId: string, task: () => Promise<T>): Promise<T> {
    const key = lockKeyFor(orderId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key}::bigint)`;
      return task();
    });
  }

  async findOrphanReservations(
    olderThanMs: number,
  ): Promise<OrphanReservationCandidate[]> {
    // Predicate is intentionally narrow — see OrderRepository port docs for
    // the safety reasoning (in-flight Stripe checkouts must stay reserved).
    const cutoff = new Date(Date.now() - olderThanMs);
    const rows = await this.prisma.order.findMany({
      where: {
        OR: [
          { status: 'CANCELLED' as PrismaOrderStatus },
          {
            status: 'PENDING' as PrismaOrderStatus,
            stripePaymentIntentId: null,
            createdAt: { lt: cutoff },
          },
        ],
      },
      select: { id: true, status: true },
      // Bound the result so a backlog can't OOM the cron run.
      take: 200,
    });
    return rows.map((r) => ({
      orderId: r.id,
      status: r.status as 'PENDING' | 'CANCELLED',
    }));
  }

  /**
   * Returns PENDING orders that already have a Stripe PaymentIntent ID and
   * whose updatedAt is older than `olderThanMs`. These are candidates for
   * the I2 "paid-but-not-confirmed" reconciliation surface check.
   *
   * We use updatedAt (not createdAt) so recently-retried orders reset the
   * clock and don't generate spurious alerts during normal 3DS delays.
   */
  async findStalePendingWithPaymentIntent(
    olderThanMs: number,
  ): Promise<Array<{ orderId: string; stripePaymentIntentId: string }>> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const rows = await this.prisma.order.findMany({
      where: {
        status: 'PENDING' as PrismaOrderStatus,
        stripePaymentIntentId: { not: null },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, stripePaymentIntentId: true },
      // Bound to avoid overwhelming Stripe rate limits on a large backlog.
      take: 50,
    });
    // Filter in JS to satisfy TypeScript: Prisma returns string | null here
    // even though the `not: null` filter guarantees non-null values.
    return rows
      .filter((r): r is typeof r & { stripePaymentIntentId: string } =>
        r.stripePaymentIntentId !== null,
      )
      .map((r) => ({ orderId: r.id, stripePaymentIntentId: r.stripePaymentIntentId }));
  }
}
