import { randomUUID } from 'node:crypto';
import {
  enrichCorrelationContext,
  recordOrderCreated,
  recordSagaCompensation,
  withSpan,
} from '@jcool/observability';
import { err, isErr, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import {
  orderCancelledEvents,
  orderCreatedEvents,
} from '../../../domain/events/order-events.js';
import { Order } from '../../../domain/order.entity.js';
import { OrderItem } from '../../../domain/order-item.entity.js';
import type { CartRepository } from '../../../domain/ports/cart.repository.js';
import type { CatalogClient } from '../../../domain/ports/catalog.client.port.js';
import type { OrderRepository } from '../../../domain/ports/order.repository.js';
import type { PaymentGateway } from '../../../domain/ports/payment-gateway.port.js';
import type { ShippingAddress } from '../../../domain/shipping-address.js';

export interface StartCheckoutInput {
  sessionKey: string;
  userId: string;
  shippingAddress: ShippingAddress;
}

export interface StartCheckoutResult {
  orderId: string;
  clientSecret: string;
}

export interface StartCheckoutDeps {
  carts: CartRepository;
  orders: OrderRepository;
  catalog: CatalogClient;
  payment: PaymentGateway;
  newId?: () => string;
}

/**
 * Checkout saga. Reserves inventory, creates the Stripe intent, persists the
 * order, and compensates (cancel + release) if a step fails. Talks to ports
 * only, no infra imports.
 */
export class StartCheckoutUseCase {
  private readonly carts: CartRepository;
  private readonly orders: OrderRepository;
  private readonly catalog: CatalogClient;
  private readonly payment: PaymentGateway;
  private readonly newId: () => string;

  constructor(deps: StartCheckoutDeps) {
    this.carts = deps.carts;
    this.orders = deps.orders;
    this.catalog = deps.catalog;
    this.payment = deps.payment;
    this.newId = deps.newId ?? randomUUID;
  }

  async execute(
    input: StartCheckoutInput,
  ): Promise<Result<StartCheckoutResult, OrderError>> {
    const cart = await this.carts.findBySessionKey(input.sessionKey);
    if (!cart || cart.isEmpty()) return err({ kind: 'CART_EMPTY' });
    if (cart.currency === null) return err({ kind: 'CART_EMPTY' });

    const currency = cart.currency;
    const orderId = this.newId();

    // snapshot the current SKU price onto each line so the order is immutable
    const items: OrderItem[] = [];
    for (const line of cart.items) {
      const sku = await this.catalog.getSku({
        skuId: line.skuId,
        productId: line.productId,
        currency,
      });
      if (isErr(sku)) return sku;
      items.push(
        OrderItem.rehydrate({
          id: this.newId(),
          orderId,
          skuId: line.skuId,
          quantity: line.quantity,
          unitAmount: sku.value.unitAmount,
          currency,
        }),
      );
    }

    const orderResult = Order.create({
      id: orderId,
      userId: input.userId,
      items,
      currency,
      shippingAddress: input.shippingAddress,
    });
    if (isErr(orderResult)) return orderResult;
    const order = orderResult.value;

    enrichCorrelationContext({ orderId, userId: input.userId });

    // reserve stock first; if it fails we only need to cancel, nothing charged yet
    const reserve = await withSpan(
      'saga.reserveInventory',
      { orderId, currency, lineCount: cart.items.length },
      () =>
        this.catalog.reserveInventory({
          orderId,
          items: cart.snapshotItems().map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
        }),
    );
    if (isErr(reserve)) {
      recordSagaCompensation('checkout', 'reserveInventory');
      const cancelled = order.cancel('INVENTORY_FAILED');
      if (isErr(cancelled)) return cancelled;
      const events = orderCancelledEvents(order, 'INVENTORY_FAILED');
      await this.orders.save(order, [events.outbox], [events.audit]);
      recordOrderCreated('cancelled_inventory', currency);
      return reserve;
    }

    const reserveLocal = order.reserveInventory();
    if (isErr(reserveLocal)) {
      // shouldn't happen, order was just created PENDING — release to be safe
      await this.catalog.releaseInventory(orderId);
      return reserveLocal;
    }

    // idempotency key = orderId so a retry reuses the same PaymentIntent
    const intent = await withSpan(
      'saga.chargePayment',
      { orderId, amount: order.totalAmount, currency },
      () =>
        this.payment.createIntent({
          orderId,
          amount: order.totalAmount,
          currency,
        }),
    );
    if (isErr(intent)) {
      // release the stock we reserved, then cancel
      await withSpan(
        'saga.compensate',
        { orderId, step: 'release-inventory', reason: 'payment-failed' },
        () => this.catalog.releaseInventory(orderId),
      );
      recordSagaCompensation('checkout', 'chargePayment');
      const cancelled = order.cancel('PAYMENT_FAILED');
      if (isErr(cancelled)) return cancelled;
      const events = orderCancelledEvents(order, 'PAYMENT_FAILED');
      await this.orders.save(order, [events.outbox], [events.audit]);
      recordOrderCreated('cancelled_payment', currency);
      return intent;
    }

    // must attach the intent id before we save — the webhook matches on it
    const attach = order.attachPaymentIntent(intent.value.stripePaymentIntentId);
    if (isErr(attach)) {
      // still persist the order so an incoming payment.succeeded can be matched
      // by payment-intent id, otherwise a paid customer has no record to reconcile
      await this.catalog.releaseInventory(orderId);
      const cancelled = order.cancel('PAYMENT_FAILED');
      if (isErr(cancelled)) return attach;
      const events = orderCancelledEvents(order, 'PAYMENT_FAILED');
      await this.orders.save(order, [events.outbox], [events.audit]);
      return attach;
    }

    const created = orderCreatedEvents(order);
    await this.orders.save(order, [created.outbox], [created.audit]);
    // 'pending' = checkout started, not revenue — revenue is counted once the
    // Stripe webhook confirms payment in MarkPaymentSucceededUseCase
    recordOrderCreated('pending', currency);

    await this.carts.delete(input.sessionKey);

    return ok({
      orderId,
      clientSecret: intent.value.clientSecret,
    });
  }
}
