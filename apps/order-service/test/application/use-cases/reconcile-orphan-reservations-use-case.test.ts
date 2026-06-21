import { describe, expect, it, vi } from 'vitest';
import { Order } from '../../../src/domain/order.entity.js';
import { OrderItem } from '../../../src/domain/order-item.entity.js';
import {
  ReconcileOrphanReservationsUseCase,
  type StalePaymentIntentCandidate,
  type StripePaymentIntentStatusClient,
} from '../../../src/application/use-cases/saga/reconcile-orphan-reservations.use-case.js';
import { InMemoryOrderRepository } from '../../fakes/in-memory-order.repository.js';
import { FakeCatalogClient } from '../../fakes/fake-catalog.client.js';
import { isOk } from '../../../src/domain/common/result.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const TWO_HOURS_AGO = new Date(Date.now() - 2 * ONE_HOUR_MS);
const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000);

const SHIPPING = {
  line1: '1 Demo St',
  city: 'Demo',
  postalCode: '12345',
  country: 'US' as const,
};

function seedOrder(opts: {
  id: string;
  status: 'PENDING' | 'CANCELLED' | 'CONFIRMED';
  stripePaymentIntentId: string | null;
  createdAt: Date;
}): Order {
  return Order.rehydrate({
    id: opts.id,
    userId: '22222222-2222-2222-2222-222222222222',
    status: opts.status,
    items: [
      OrderItem.rehydrate({
        id: `${opts.id}-item`,
        orderId: opts.id,
        skuId: '33333333-3333-3333-3333-333333333333',
        quantity: 1,
        unitAmount: 1999,
        currency: 'USD',
      }),
    ],
    totalAmount: 1999,
    currency: 'USD',
    stripePaymentIntentId: opts.stripePaymentIntentId,
    shippingAddress: SHIPPING,
    cancelReason: null,
    createdAt: opts.createdAt,
    updatedAt: opts.createdAt,
  });
}

interface Sut {
  sut: ReconcileOrphanReservationsUseCase;
  orders: InMemoryOrderRepository;
  catalog: FakeCatalogClient;
}

function makeSut(): Sut {
  const orders = new InMemoryOrderRepository();
  const catalog = new FakeCatalogClient();
  const sut = new ReconcileOrphanReservationsUseCase({
    orders,
    catalog,
    findOrphans: (ms) => orders.findOrphanReservations(ms),
    olderThanMs: ONE_HOUR_MS,
  });
  return { sut, orders, catalog };
}

describe('ReconcileOrphanReservationsUseCase', () => {
  it('releases inventory for CANCELLED orders regardless of payment intent', async () => {
    const { sut, orders, catalog } = makeSut();
    orders.seed(
      seedOrder({
        id: 'order-cancelled-1',
        status: 'CANCELLED',
        // Even with a payment intent recorded, a CANCELLED order is safe to
        // release — the saga has already failed and Stripe won't move it.
        stripePaymentIntentId: 'pi_cancelled_one',
        createdAt: TWO_HOURS_AGO,
      }),
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.released).toBe(1);
      expect(result.value.skipped).toBe(0);
    }
    expect(catalog.releaseCalls).toEqual(['order-cancelled-1']);
  });

  it('releases inventory for stale PENDING orders WITHOUT a payment intent', async () => {
    const { sut, orders, catalog } = makeSut();
    orders.seed(
      seedOrder({
        id: 'order-orphan-1',
        status: 'PENDING',
        stripePaymentIntentId: null,
        createdAt: TWO_HOURS_AGO,
      }),
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    expect(catalog.releaseCalls).toEqual(['order-orphan-1']);
  });

  it('IN-FLIGHT GUARD — does NOT release a PENDING order that has a Stripe paymentIntent set', async () => {
    // This is the F2 safety invariant. A PENDING order with a payment
    // intent means the customer is mid-checkout in Stripe; releasing
    // inventory here would oversell under a paying customer.
    const { sut, orders, catalog } = makeSut();
    orders.seed(
      seedOrder({
        id: 'order-in-flight',
        status: 'PENDING',
        stripePaymentIntentId: 'pi_in_flight_abc',
        createdAt: TWO_HOURS_AGO,
      }),
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.released).toBe(0);
      expect(result.value.skipped).toBe(0);
    }
    // Crucial — the catalog must NEVER have been asked to release the
    // in-flight order. A single call here is a regression.
    expect(catalog.releaseCalls).toEqual([]);
  });

  it('does not release recent PENDING orders even without a payment intent', async () => {
    // The cron must wait for the 1h cooldown before reclaiming inventory
    // — Stripe checkout flows take minutes, and we don't want to race a
    // user who just started checkout in another tab.
    const { sut, orders, catalog } = makeSut();
    orders.seed(
      seedOrder({
        id: 'order-fresh',
        status: 'PENDING',
        stripePaymentIntentId: null,
        createdAt: FIVE_MIN_AGO,
      }),
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    expect(catalog.releaseCalls).toEqual([]);
  });

  it('does not touch CONFIRMED orders', async () => {
    const { sut, orders, catalog } = makeSut();
    orders.seed(
      seedOrder({
        id: 'order-confirmed',
        status: 'CONFIRMED',
        stripePaymentIntentId: 'pi_confirmed_x',
        createdAt: TWO_HOURS_AGO,
      }),
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    expect(catalog.releaseCalls).toEqual([]);
  });

  it('returns released count and skipped count when catalog refuses some releases', async () => {
    const { sut, orders, catalog } = makeSut();
    orders.seed(
      seedOrder({
        id: 'order-orphan-a',
        status: 'PENDING',
        stripePaymentIntentId: null,
        createdAt: TWO_HOURS_AGO,
      }),
    );
    orders.seed(
      seedOrder({
        id: 'order-orphan-b',
        status: 'CANCELLED',
        stripePaymentIntentId: null,
        createdAt: TWO_HOURS_AGO,
      }),
    );
    catalog.setReleaseOutcome({
      ok: false,
      error: { kind: 'CATALOG_UNAVAILABLE', reason: 'connection refused' },
    });

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      // Both orders are orphans → both are attempted; both fail → both skipped.
      expect(result.value.released).toBe(0);
      expect(result.value.skipped).toBe(2);
    }
    expect(catalog.releaseCalls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// I2: stale PENDING + piid reconciliation — surface "paid-but-not-confirmed"
// ---------------------------------------------------------------------------

/** Fake Stripe client whose retrieve() return value is scriptable per-test. */
class FakeStripeStatusClient implements StripePaymentIntentStatusClient {
  private outcomes = new Map<string, { id: string; status: string }>();
  readonly retrieveCalls: string[] = [];

  setStatus(piid: string, status: string): this {
    this.outcomes.set(piid, { id: piid, status });
    return this;
  }

  async retrieve(piid: string): Promise<{ id: string; status: string }> {
    this.retrieveCalls.push(piid);
    const outcome = this.outcomes.get(piid);
    if (!outcome) throw new Error(`FakeStripeStatusClient: no outcome for ${piid}`);
    return outcome;
  }
}

function makeSutWithStaleScan(
  staleOrders: StalePaymentIntentCandidate[],
  stripe: StripePaymentIntentStatusClient,
) {
  const orders = new InMemoryOrderRepository();
  const catalog = new FakeCatalogClient();
  const sut = new ReconcileOrphanReservationsUseCase({
    orders,
    catalog,
    findOrphans: (ms) => orders.findOrphanReservations(ms),
    findStalePendingWithPiid: async (_ms) => staleOrders,
    stripeClient: stripe,
    olderThanMs: ONE_HOUR_MS,
    stalePiidThresholdMs: FIFTEEN_MIN_MS,
  });
  return { sut, orders, catalog };
}

describe('ReconcileOrphanReservationsUseCase — I2 stale-paid surface check', () => {
  it('alerts (stalePaymentAlerts=1) when Stripe PI is succeeded but order is still PENDING', async () => {
    const stripe = new FakeStripeStatusClient().setStatus('pi_paid_stuck', 'succeeded');
    const { sut } = makeSutWithStaleScan(
      [{ orderId: 'order-stuck-1', stripePaymentIntentId: 'pi_paid_stuck' }],
      stripe,
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.stalePaymentAlerts).toBe(1);
      // The reconciler must NOT auto-confirm — released/skipped untouched.
      expect(result.value.released).toBe(0);
      expect(result.value.skipped).toBe(0);
    }
    expect(stripe.retrieveCalls).toContain('pi_paid_stuck');
  });

  it('does not alert when Stripe PI status is requires_payment_method (failed checkout)', async () => {
    const stripe = new FakeStripeStatusClient().setStatus('pi_failed', 'requires_payment_method');
    const { sut } = makeSutWithStaleScan(
      [{ orderId: 'order-failed-1', stripePaymentIntentId: 'pi_failed' }],
      stripe,
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.stalePaymentAlerts).toBe(0);
    }
  });

  it('does not alert when Stripe PI status is processing (3DS in flight)', async () => {
    const stripe = new FakeStripeStatusClient().setStatus('pi_3ds', 'processing');
    const { sut } = makeSutWithStaleScan(
      [{ orderId: 'order-3ds', stripePaymentIntentId: 'pi_3ds' }],
      stripe,
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) expect(result.value.stalePaymentAlerts).toBe(0);
  });

  it('counts multiple paid-but-stuck orders correctly', async () => {
    const stripe = new FakeStripeStatusClient()
      .setStatus('pi_stuck_a', 'succeeded')
      .setStatus('pi_stuck_b', 'succeeded')
      .setStatus('pi_ok', 'processing');
    const { sut } = makeSutWithStaleScan(
      [
        { orderId: 'order-a', stripePaymentIntentId: 'pi_stuck_a' },
        { orderId: 'order-b', stripePaymentIntentId: 'pi_stuck_b' },
        { orderId: 'order-c', stripePaymentIntentId: 'pi_ok' },
      ],
      stripe,
    );

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) expect(result.value.stalePaymentAlerts).toBe(2);
    expect(stripe.retrieveCalls).toHaveLength(3);
  });

  it('tolerates Stripe retrieve failure gracefully — does not throw, skips that order', async () => {
    const retrieveCalls: string[] = [];
    const stripe: StripePaymentIntentStatusClient = {
      async retrieve(piid: string): Promise<{ id: string; status: string }> {
        retrieveCalls.push(piid);
        throw new Error('stripe timeout');
      },
    };

    const { sut } = makeSutWithStaleScan(
      [{ orderId: 'order-timeout', stripePaymentIntentId: 'pi_timeout' }],
      stripe,
    );

    const result = await sut.execute();

    // Must not throw — cron keeps running on Stripe errors.
    expect(isOk(result)).toBe(true);
    if (result.ok) expect(result.value.stalePaymentAlerts).toBe(0);
  });

  it('returns stalePaymentAlerts=0 when no stale-piid scanner is wired (backwards compat)', async () => {
    // Pre-I2 callers that do not pass findStalePendingWithPiid must still work.
    const orders = new InMemoryOrderRepository();
    const catalog = new FakeCatalogClient();
    const sut = new ReconcileOrphanReservationsUseCase({
      orders,
      catalog,
      findOrphans: (ms) => orders.findOrphanReservations(ms),
      // intentionally omit findStalePendingWithPiid and stripeClient
      olderThanMs: ONE_HOUR_MS,
    });

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) expect(result.value.stalePaymentAlerts).toBe(0);
  });

  it('IN-FLIGHT GUARD preserved — orphan scan still skips PENDING+piid (no inventory release)', async () => {
    // The I2 path only surfaces alerts; it must never cause the orphan scan
    // to widen its predicate and release inventory for in-flight orders.
    const stripe = new FakeStripeStatusClient().setStatus('pi_live', 'processing');
    const orders = new InMemoryOrderRepository();
    const catalog = new FakeCatalogClient();
    orders.seed(
      seedOrder({
        id: 'order-in-flight-2',
        status: 'PENDING',
        stripePaymentIntentId: 'pi_live',
        createdAt: TWO_HOURS_AGO,
      }),
    );
    const sut = new ReconcileOrphanReservationsUseCase({
      orders,
      catalog,
      findOrphans: (ms) => orders.findOrphanReservations(ms),
      findStalePendingWithPiid: async (_ms) => [
        { orderId: 'order-in-flight-2', stripePaymentIntentId: 'pi_live' },
      ],
      stripeClient: stripe,
      olderThanMs: ONE_HOUR_MS,
    });

    const result = await sut.execute();

    expect(isOk(result)).toBe(true);
    if (result.ok) {
      // No inventory released — alert only.
      expect(result.value.released).toBe(0);
    }
    // Catalog must never have been asked to release.
    expect(catalog.releaseCalls).toEqual([]);
  });
});
