import type { OrderStatus } from '@jcool/contracts';
import type { Order } from '../order.entity.js';

/**
 * Cron-driven reconciliation reads only the columns it needs to decide
 * whether to release a reservation — we don't want to rehydrate the
 * whole aggregate just to look at status + payment-intent presence.
 */
export interface OrphanReservationCandidate {
  orderId: string;
  status: 'PENDING' | 'CANCELLED';
}

export interface OutboxAppend {
  routingKey: string;
  payload: unknown;
}

export interface OrderEventAppend {
  type: string;
  payload: unknown;
}

export interface OrderListFilter {
  userId?: string;
  status?: OrderStatus;
}

export interface OrderListCursor {
  cursor: string | null;
  limit: number;
}

export interface OrderListPage {
  items: Order[];
  nextCursor: string | null;
}

/**
 * Repository port for the Order aggregate.
 *
 * - `save` persists the aggregate + appends outbox + audit rows in ONE
 *   transaction (transactional outbox pattern).
 * - `withAdvisoryLock` acquires `pg_advisory_xact_lock` keyed on orderId
 *   so two saga steps for the same order serialise.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Order | null>;
  list(filter: OrderListFilter, page: OrderListCursor): Promise<OrderListPage>;

  save(
    order: Order,
    outbox?: OutboxAppend[],
    audit?: OrderEventAppend[],
  ): Promise<Order>;

  /**
   * Runs `task` inside a Postgres transaction with `pg_advisory_xact_lock`
   * acquired on a deterministic hash of `orderId`. Two callers contending
   * for the same orderId serialise; different orderIds run in parallel.
   */
  withAdvisoryLock<T>(orderId: string, task: () => Promise<T>): Promise<T>;

  /**
   * Reservation reconciliation predicate — release inventory only when
   * BOTH safety conditions hold:
   *
   *   status = CANCELLED
   *     OR
   *   (status = PENDING AND stripePaymentIntentId IS NULL
   *    AND createdAt < now() - olderThanMs)
   *
   * Widening to "PENDING with payment intent" would race the live Stripe
   * checkout and release stock under a paying customer.
   */
  findOrphanReservations(olderThanMs: number): Promise<OrphanReservationCandidate[]>;

  /**
   * I2 reconciliation surface: PENDING orders that have a Stripe PaymentIntent
   * ID and have not progressed within `olderThanMs`. The cron pairs each with
   * a Stripe lookup to alert on paid-but-not-confirmed orders.
   */
  findStalePendingWithPaymentIntent(
    olderThanMs: number,
  ): Promise<Array<{ orderId: string; stripePaymentIntentId: string }>>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
