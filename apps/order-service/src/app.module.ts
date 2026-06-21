import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ObservabilityModule } from '@jcool/observability';
import Stripe from 'stripe';

type StripeInstance = InstanceType<typeof Stripe>;

import { CartController } from './interfaces/http/cart.controller.js';
import { OrdersController } from './interfaces/http/orders.controller.js';
import { StripeWebhooksController } from './interfaces/http/stripe-webhooks.controller.js';
import { JwtAuthGuard } from './interfaces/http/jwt-auth.guard.js';
import { AdminRoleGuard } from '@jcool/nest-kit';

import { AddToCartUseCase } from './application/use-cases/cart/add-to-cart.use-case.js';
import { RemoveFromCartUseCase } from './application/use-cases/cart/remove-from-cart.use-case.js';
import { UpdateCartQuantityUseCase } from './application/use-cases/cart/update-cart-quantity.use-case.js';
import { ClearCartUseCase } from './application/use-cases/cart/clear-cart.use-case.js';
import { GetCartUseCase } from './application/use-cases/cart/get-cart.use-case.js';
import { MergeGuestCartUseCase } from './application/use-cases/cart/merge-guest-cart.use-case.js';

import { GetOrderUseCase } from './application/use-cases/orders/get-order.use-case.js';
import { ListUserOrdersUseCase } from './application/use-cases/orders/list-user-orders.use-case.js';
import { ListAllOrdersUseCase } from './application/use-cases/orders/list-all-orders.use-case.js';
import { UpdateOrderStatusUseCase } from './application/use-cases/orders/update-order-status.use-case.js';

import { StartCheckoutUseCase } from './application/use-cases/saga/start-checkout.use-case.js';
import { MarkPaymentSucceededUseCase } from './application/use-cases/saga/mark-payment-succeeded.use-case.js';
import { MarkPaymentFailedUseCase } from './application/use-cases/saga/mark-payment-failed.use-case.js';
import { HandleStripeWebhookUseCase } from './application/use-cases/payment/handle-stripe-webhook.use-case.js';

import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from './domain/ports/order.repository.js';
import {
  CART_REPOSITORY,
  type CartRepository,
} from './domain/ports/cart.repository.js';
import {
  CATALOG_CLIENT,
  type CatalogClient,
} from './domain/ports/catalog.client.port.js';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from './domain/ports/payment-gateway.port.js';
import { OUTBOX_REPOSITORY } from './domain/ports/outbox.repository.js';
import {
  WEBHOOK_EVENT_REPOSITORY,
  type WebhookEventRepository,
} from './domain/ports/webhook-event.repository.js';
import {
  DIRECT_EVENT_PUBLISHER,
  type DirectEventPublisher,
} from './application/ports/direct-event-publisher.port.js';

import { PrismaService } from './infrastructure/persistence/prisma.service.js';
import { PrismaOrderRepository } from './infrastructure/persistence/prisma-order.repository.js';
import { PrismaOutboxRepository } from './infrastructure/persistence/prisma-outbox.repository.js';
import { PrismaWebhookEventRepository } from './infrastructure/persistence/prisma-webhook-event.repository.js';
import { RedisCartRepository } from './infrastructure/persistence/redis-cart.repository.js';
import { HttpCatalogClient } from './infrastructure/clients/http-catalog.client.adapter.js';
import { JwtVerifier } from './infrastructure/auth/jwt-verifier.adapter.js';
import { StripePaymentGatewayAdapter } from './infrastructure/stripe/stripe-payment-gateway.adapter.js';
import {
  StripePaymentIntentStatusAdapter,
  STRIPE_PAYMENT_INTENT_STATUS_CLIENT,
} from './infrastructure/stripe/stripe-payment-intent-status.adapter.js';
import { StripeSdkSignatureVerifier } from './infrastructure/stripe/stripe-signature-verifier.adapter.js';
import { STRIPE_SIGNATURE_VERIFIER } from './infrastructure/stripe/stripe-signature-verifier.port.js';
import type { StripePaymentIntentsClient } from './infrastructure/stripe/stripe-payment-intents.port.js';
import { RabbitMqEventPublisher } from './infrastructure/messaging/rabbitmq-event-publisher.adapter.js';
import { RabbitMqDirectEventPublisher } from './infrastructure/messaging/rabbitmq-direct-event-publisher.adapter.js';
import { OutboxPollerCron } from './infrastructure/messaging/outbox-poller.cron.js';
import { ReservationCleanupCron } from './infrastructure/scheduling/reservation-cleanup.cron.js';

import { RabbitMqConnection } from './interfaces/consumers/rabbitmq-connection.service.js';
import { PaymentResultConsumer } from './interfaces/consumers/payment-result.consumer.js';
import { DLQDepthPollerService } from './infrastructure/metrics/dlq-depth-poller.service.js';

// Single Stripe SDK token — both the payment-intent adapter and the
// signature-verifier adapter consume the same SDK instance. Missing key
// in dev surfaces lazily on first paymentIntents.create (401) rather
// than at boot, so non-payment flows still run without keys.
const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    ObservabilityModule.forRoot({ service: 'order-service' }),
  ],
  controllers: [CartController, OrdersController, StripeWebhooksController],
  providers: [
    PrismaService,
    JwtVerifier,
    JwtAuthGuard,
    AdminRoleGuard,
    RabbitMqEventPublisher,
    RabbitMqConnection,
    OutboxPollerCron,
    ReservationCleanupCron,
    PaymentResultConsumer,
    DLQDepthPollerService,

    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },
    { provide: CART_REPOSITORY, useClass: RedisCartRepository },
    { provide: CATALOG_CLIENT, useClass: HttpCatalogClient },
    { provide: WEBHOOK_EVENT_REPOSITORY, useClass: PrismaWebhookEventRepository },

    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StripeInstance =>
        // Pin apiVersion so upstream Stripe schema changes do not silently
        // mutate the PaymentIntent shape our mapper depends on. Bump
        // intentionally + regression-test when upgrading.
        new Stripe(config.get<string>('STRIPE_SECRET_KEY') ?? '', {
          apiVersion: '2026-05-27.dahlia',
        }),
    },

    {
      provide: PAYMENT_GATEWAY,
      inject: [STRIPE_CLIENT],
      useFactory: (stripe: StripeInstance): PaymentGateway =>
        new StripePaymentGatewayAdapter(
          stripe.paymentIntents as unknown as StripePaymentIntentsClient,
        ),
    },

    {
      provide: STRIPE_PAYMENT_INTENT_STATUS_CLIENT,
      inject: [STRIPE_CLIENT],
      useFactory: (stripe: StripeInstance) =>
        new StripePaymentIntentStatusAdapter(
          stripe.paymentIntents as unknown as StripePaymentIntentsClient,
        ),
    },

    {
      provide: STRIPE_SIGNATURE_VERIFIER,
      inject: [STRIPE_CLIENT, ConfigService],
      useFactory: (stripe: StripeInstance, config: ConfigService) =>
        new StripeSdkSignatureVerifier(
          stripe,
          config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '',
        ),
    },

    {
      provide: DIRECT_EVENT_PUBLISHER,
      inject: [RabbitMqEventPublisher],
      useFactory: (publisher: RabbitMqEventPublisher): DirectEventPublisher =>
        new RabbitMqDirectEventPublisher(publisher),
    },

    {
      provide: AddToCartUseCase,
      inject: [CART_REPOSITORY, CATALOG_CLIENT],
      useFactory: (c: CartRepository, k: CatalogClient) => new AddToCartUseCase(c, k),
    },
    {
      provide: RemoveFromCartUseCase,
      inject: [CART_REPOSITORY],
      useFactory: (c: CartRepository) => new RemoveFromCartUseCase(c),
    },
    {
      provide: UpdateCartQuantityUseCase,
      inject: [CART_REPOSITORY, CATALOG_CLIENT],
      useFactory: (c: CartRepository, k: CatalogClient) =>
        new UpdateCartQuantityUseCase(c, k),
    },
    {
      provide: ClearCartUseCase,
      inject: [CART_REPOSITORY],
      useFactory: (c: CartRepository) => new ClearCartUseCase(c),
    },
    {
      provide: GetCartUseCase,
      inject: [CART_REPOSITORY, CATALOG_CLIENT],
      useFactory: (c: CartRepository, k: CatalogClient) => new GetCartUseCase(c, k),
    },
    {
      provide: MergeGuestCartUseCase,
      inject: [CART_REPOSITORY],
      useFactory: (c: CartRepository) => new MergeGuestCartUseCase(c),
    },

    {
      provide: GetOrderUseCase,
      inject: [ORDER_REPOSITORY],
      useFactory: (o: OrderRepository) => new GetOrderUseCase(o),
    },
    {
      provide: ListUserOrdersUseCase,
      inject: [ORDER_REPOSITORY],
      useFactory: (o: OrderRepository) => new ListUserOrdersUseCase(o),
    },
    {
      provide: ListAllOrdersUseCase,
      inject: [ORDER_REPOSITORY],
      useFactory: (o: OrderRepository) => new ListAllOrdersUseCase(o),
    },
    {
      provide: UpdateOrderStatusUseCase,
      inject: [ORDER_REPOSITORY],
      useFactory: (o: OrderRepository) => new UpdateOrderStatusUseCase(o),
    },

    {
      provide: StartCheckoutUseCase,
      inject: [CART_REPOSITORY, ORDER_REPOSITORY, CATALOG_CLIENT, PAYMENT_GATEWAY],
      useFactory: (
        carts: CartRepository,
        orders: OrderRepository,
        catalog: CatalogClient,
        payment: PaymentGateway,
      ) => new StartCheckoutUseCase({ carts, orders, catalog, payment }),
    },
    {
      provide: MarkPaymentSucceededUseCase,
      inject: [ORDER_REPOSITORY],
      useFactory: (o: OrderRepository) => new MarkPaymentSucceededUseCase(o),
    },
    {
      provide: MarkPaymentFailedUseCase,
      inject: [ORDER_REPOSITORY, CATALOG_CLIENT],
      useFactory: (o: OrderRepository, k: CatalogClient) =>
        new MarkPaymentFailedUseCase(o, k),
    },
    {
      provide: HandleStripeWebhookUseCase,
      inject: [WEBHOOK_EVENT_REPOSITORY, DIRECT_EVENT_PUBLISHER],
      useFactory: (
        events: WebhookEventRepository,
        publisher: DirectEventPublisher,
      ) => new HandleStripeWebhookUseCase(events, publisher),
    },
  ],
})
export class AppModule {}
