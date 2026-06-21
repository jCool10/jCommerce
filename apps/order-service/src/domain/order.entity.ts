import type { Currency, OrderCancelReason, OrderStatus } from '@jcool/contracts';
import { err, ok, type Result } from './common/result.js';
import type { OrderError } from './order-error.js';
import type { OrderItem } from './order-item.entity.js';
import type { ShippingAddress } from './shipping-address.js';
import { canTransition } from './order-status.js';

export interface OrderProps {
  id: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  currency: Currency;
  stripePaymentIntentId: string | null;
  shippingAddress: ShippingAddress;
  cancelReason: OrderCancelReason | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  id: string;
  userId: string;
  items: OrderItem[];
  currency: Currency;
  shippingAddress: ShippingAddress;
}

/**
 * Order aggregate root. Owns its OrderItem children — they are loaded and
 * persisted together so transactional consistency is the repository's job
 * (single $transaction per save).
 *
 * Mutating methods enforce FSM via order-status.ts and return Result rather
 * than throwing, so the saga orchestrator can decide compensation without
 * try/catch flow.
 */
export class Order {
  private constructor(private state: OrderProps) {}

  // ─── getters ────────────────────────────────────────────────────────
  get id(): string {
    return this.state.id;
  }
  get userId(): string {
    return this.state.userId;
  }
  get status(): OrderStatus {
    return this.state.status;
  }
  get items(): OrderItem[] {
    return [...this.state.items];
  }
  get totalAmount(): number {
    return this.state.totalAmount;
  }
  get currency(): Currency {
    return this.state.currency;
  }
  get stripePaymentIntentId(): string | null {
    return this.state.stripePaymentIntentId;
  }
  get shippingAddress(): ShippingAddress {
    return { ...this.state.shippingAddress };
  }
  get cancelReason(): OrderCancelReason | null {
    return this.state.cancelReason;
  }
  get createdAt(): Date {
    return this.state.createdAt;
  }
  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  // ─── constructors ───────────────────────────────────────────────────
  static rehydrate(props: OrderProps): Order {
    return new Order({ ...props, items: [...props.items] });
  }

  static create(input: CreateOrderInput): Result<Order, OrderError> {
    if (input.items.length === 0) return err({ kind: 'CART_EMPTY' });

    for (const item of input.items) {
      if (item.currency !== input.currency) {
        return err({
          kind: 'CART_CURRENCY_LOCKED',
          locked: input.currency,
          attempted: item.currency,
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return err({ kind: 'INVALID_QUANTITY', reason: 'NON_POSITIVE' });
      }
    }

    const totalAmount = input.items.reduce((sum, i) => sum + i.lineTotal, 0);
    const now = new Date();
    return ok(
      new Order({
        id: input.id,
        userId: input.userId,
        status: 'PENDING',
        items: input.items,
        totalAmount,
        currency: input.currency,
        stripePaymentIntentId: null,
        shippingAddress: { ...input.shippingAddress },
        cancelReason: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  // ─── FSM mutations ──────────────────────────────────────────────────
  reserveInventory(): Result<void, OrderError> {
    return this.transitionTo('INVENTORY_RESERVED');
  }

  /**
   * Attaches a Stripe PaymentIntent ID and moves to PAYMENT_PENDING.
   *
   * The orchestrator must set this before persisting and before returning to
   * the client: the reconcile cron treats `status=PENDING AND
   * stripePaymentIntentId IS NULL AND age>1h` as an orphaned reservation, so a
   * null id past PAYMENT_PENDING would get wrongly released.
   */
  attachPaymentIntent(stripePaymentIntentId: string): Result<void, OrderError> {
    if (this.state.stripePaymentIntentId !== null) {
      return err({ kind: 'PAYMENT_INTENT_ALREADY_SET' });
    }
    const transition = this.transitionTo('PAYMENT_PENDING');
    if (!transition.ok) return transition;
    this.state = {
      ...this.state,
      stripePaymentIntentId,
      updatedAt: new Date(),
    };
    return ok(undefined);
  }

  confirm(): Result<void, OrderError> {
    if (this.state.stripePaymentIntentId === null) {
      return err({ kind: 'PAYMENT_INTENT_MISSING' });
    }
    return this.transitionTo('CONFIRMED');
  }

  markShipped(): Result<void, OrderError> {
    return this.transitionTo('SHIPPED');
  }

  markDelivered(): Result<void, OrderError> {
    return this.transitionTo('DELIVERED');
  }

  cancel(reason: OrderCancelReason): Result<void, OrderError> {
    const transition = this.transitionTo('CANCELLED');
    if (!transition.ok) return transition;
    this.state = {
      ...this.state,
      cancelReason: reason,
      updatedAt: new Date(),
    };
    return ok(undefined);
  }

  // Generic FSM gate. Exposed because admin-status updates may go through
  // a single PATCH endpoint and the controller validates the target status.
  transitionTo(to: OrderStatus): Result<void, OrderError> {
    const from = this.state.status;
    if (!canTransition(from, to)) {
      return err({ kind: 'INVALID_TRANSITION', from, to });
    }
    this.state = { ...this.state, status: to, updatedAt: new Date() };
    return ok(undefined);
  }

  toJSON(): OrderProps {
    return {
      ...this.state,
      items: [...this.state.items],
      shippingAddress: { ...this.state.shippingAddress },
    };
  }
}
