import type { OrderStatus } from '@jcool/contracts';
import { Order } from '../../src/domain/order.entity.js';
import type {
  OrderEventAppend,
  OrderListCursor,
  OrderListFilter,
  OrderListPage,
  OrderRepository,
  OrphanReservationCandidate,
  OutboxAppend,
} from '../../src/domain/ports/order.repository.js';

interface RepoState {
  orders: Order[];
  outbox: OutboxAppend[];
  audit: Array<OrderEventAppend & { orderId: string }>;
}

export class InMemoryOrderRepository implements OrderRepository {
  private state: RepoState = { orders: [], outbox: [], audit: [] };

  // ── inspection helpers for tests ─────────────────────────────────
  get outbox(): OutboxAppend[] {
    return [...this.state.outbox];
  }
  get auditEvents(): Array<OrderEventAppend & { orderId: string }> {
    return [...this.state.audit];
  }

  async findById(id: string): Promise<Order | null> {
    return this.state.orders.find((o) => o.id === id) ?? null;
  }

  async findByStripePaymentIntentId(piid: string): Promise<Order | null> {
    return this.state.orders.find((o) => o.stripePaymentIntentId === piid) ?? null;
  }

  async list(filter: OrderListFilter, page: OrderListCursor): Promise<OrderListPage> {
    let rows = [...this.state.orders];
    if (filter.userId) rows = rows.filter((o) => o.userId === filter.userId);
    if (filter.status) rows = rows.filter((o) => o.status === filter.status);
    rows.sort((a, b) => a.id.localeCompare(b.id));
    const startIdx = page.cursor
      ? rows.findIndex((o) => o.id === page.cursor) + 1
      : 0;
    const slice = rows.slice(startIdx, startIdx + page.limit);
    const nextCursor =
      startIdx + page.limit < rows.length ? slice.at(-1)!.id : null;
    return { items: slice, nextCursor };
  }

  async save(
    order: Order,
    outbox: OutboxAppend[] = [],
    audit: OrderEventAppend[] = [],
  ): Promise<Order> {
    const idx = this.state.orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) this.state.orders[idx] = order;
    else this.state.orders.push(order);
    for (const e of outbox) this.state.outbox.push(e);
    for (const a of audit) this.state.audit.push({ ...a, orderId: order.id });
    return order;
  }

  // No real lock in memory — but we expose call tracking so tests can verify
  // the saga ALWAYS wraps payment-result handlers in withAdvisoryLock.
  readonly lockCalls: string[] = [];
  async withAdvisoryLock<T>(orderId: string, task: () => Promise<T>): Promise<T> {
    this.lockCalls.push(orderId);
    return task();
  }

  // Mirrors the Prisma adapter's safety predicate. The point of duplicating
  // it here (instead of just returning everything) is so that the cron's
  // safety invariant is asserted at the unit-test layer too — a PR that
  // weakens the in-memory predicate to make a test pass will also break
  // the dedicated guard test in reservation-cleanup-cron.test.ts.
  async findOrphanReservations(
    olderThanMs: number,
  ): Promise<OrphanReservationCandidate[]> {
    const cutoff = Date.now() - olderThanMs;
    return this.state.orders
      .filter((o) => {
        if (o.status === 'CANCELLED') return true;
        if (o.status !== 'PENDING') return false;
        if (o.stripePaymentIntentId !== null) return false;
        return o.createdAt.getTime() < cutoff;
      })
      .map((o) => ({
        orderId: o.id,
        status: o.status as 'PENDING' | 'CANCELLED',
      }));
  }

  async findStalePendingWithPaymentIntent(
    olderThanMs: number,
  ): Promise<Array<{ orderId: string; stripePaymentIntentId: string }>> {
    const cutoff = Date.now() - olderThanMs;
    return this.state.orders
      .filter(
        (o) =>
          o.status === 'PENDING' &&
          o.stripePaymentIntentId !== null &&
          o.updatedAt.getTime() < cutoff,
      )
      .map((o) => ({
        orderId: o.id,
        stripePaymentIntentId: o.stripePaymentIntentId as string,
      }));
  }

  // ── seed helpers ─────────────────────────────────────────────────
  seed(order: Order): this {
    this.state.orders.push(order);
    return this;
  }

  countByStatus(status: OrderStatus): number {
    return this.state.orders.filter((o) => o.status === status).length;
  }
}
