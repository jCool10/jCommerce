# Architecture Patterns: Transactional Outbox, Saga, Idempotency, Multi-Currency

**Deep walkthroughs of four critical patterns implemented across the jCool platform.**

---

## Transactional Outbox Pattern

**Problem:** Microservices must publish events durably. If a service crashes after domain mutation but before publishing, the event is lost and consumers miss state changes.

**Solution:** Atomically persist mutation + event in one database transaction. A background poller asynchronously publishes unpublished events.

### Implementation

#### 1. Domain Event (Immutable)

```typescript
// domain/events/order-created.event.ts
export class OrderCreatedEvent extends DomainEvent {
  readonly version = 1;

  constructor(
    readonly orderId: string,
    readonly userId: string,
    readonly totalAmount: number,
    readonly currency: string,
  ) {
    super();
  }
}
```

#### 2. Outbox Table Schema

```sql
-- apps/order-service/prisma/schema.prisma
model OutboxEvent {
  id               String    @id @default(cuid())
  routingKey       String    // e.g., "order.created"
  payload          Json      // Serialized event
  createdAt        DateTime  @default(now())
  publishedAt      DateTime? // NULL until published

  @@index([publishedAt, createdAt])
}
```

#### 3. Save in One Transaction

```typescript
// application/use-cases/saga/start-checkout.use-case.ts
async execute(command: StartCheckoutCommand): Promise<Result<...>> {
  // ... build order, validate inventory, create Stripe intent ...

  // CRITICAL: One transaction
  const result = await this.prisma.$transaction(async (tx) => {
    // Save order
    const order = await tx.order.create({
      data: { /* ... */ },
    });

    // Save outbox event
    await tx.outboxEvent.create({
      data: {
        routingKey: 'order.created',
        payload: new OrderCreatedEvent(
          order.id,
          command.userId,
          order.totalAmount,
          order.currency,
        ),
      },
    });

    return order;
  });

  return Ok(result);
}
```

#### 4. Poller (Background Cron)

```typescript
// infrastructure/messaging/outbox-poller.cron.ts
@Injectable()
export class OutboxPollerCron {
  @Cron(CronExpression.EVERY_1_SECOND)
  async poll(): Promise<void> {
    const batch = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize, // e.g., 100
      // SKIP LOCKED prevents concurrent poller instances from processing same event
    });

    for (const event of batch) {
      try {
        await this.rabbitmqPublisher.publish(event.routingKey, event.payload);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { publishedAt: new Date() },
        });
      } catch (error) {
        this.logger.error('Failed to publish outbox event', { event, error });
        // Retry next poll cycle
      }
    }
  }
}
```

### Guarantees
- ✅ **No lost events** — mutation + outbox in one atomic transaction
- ✅ **At-least-once delivery** — subscriber must be idempotent
- ✅ **No duplicate events** — `publishedAt` prevents re-publishing after success

### When the Poller Crashes
- Event remains unpublished (publishedAt is NULL)
- Next poller cycle picks it up and retries
- At-least-once semantics (subscriber handles duplicates via Stripe webhook pattern)

---

## Saga Pattern: Distributed Transaction with Compensation

**Problem:** Checkout involves multiple services (catalog, Stripe, email). If one fails partway through, prior steps must roll back.

**Solution:** Orchestrate steps explicitly with compensation (rollback) paths. No exceptions—use Result<T, E>.

### Order Checkout Saga (10 Steps)

**File:** `apps/order-service/src/application/use-cases/saga/start-checkout.use-case.ts`

#### Happy Path

1. Snapshot cart from Redis
2. Fetch SKU prices from catalog service
3. Build Order + items, compute total amount
4. Reserve inventory via catalog POST /inventory/reserve (sync RPC) — **CRITICAL**
5. Create Stripe PaymentIntent with idempotency key = orderId
6. Attach PaymentIntent ID to order
7. Save order + outbox event in one Prisma transaction
8. Clear cart from Redis
9. Return {orderId, clientSecret} to client
10. ✅ Order now PENDING, awaiting webhook callback

#### Compensation Paths

**If Step 4 fails (inventory unavailable):**
- Compensation: Cancel order (nothing to release, reservation never happened)
- Return Err(InventoryUnavailable) to client

**If Step 5 fails (Stripe timeout/error):**
- Compensation: Release inventory (call catalog POST /inventory/release) + cancel order
- Return Err(PaymentError) to client

**If Step 7 fails (database error):**
- Compensation: Release inventory + cancel PaymentIntent (via Stripe API) + cancel order
- Return Err(DatabaseError) to client

### Result<T, E> Pattern

```typescript
async execute(command: StartCheckoutCommand): Promise<Result<CheckoutResponse, CheckoutError>> {
  // Step 1–3 (cart snapshot + pricing)
  const cart = await this.snapshotCart(command.sessionKey);
  if (!cart || cart.items.length === 0) {
    return Err(new EmptyCartError());
  }

  // Step 4 (inventory reserve)
  const reserveResult = await this.catalogClient.reserveInventory(cart.items);
  if (reserveResult.isFailure()) {
    return Err(new InventoryUnavailableError(reserveResult.error));
  }

  // Step 5 (Stripe)
  const intentResult = await this.stripeGateway.createPaymentIntent({
    amount: order.totalAmount,
    idempotencyKey: order.id,
  });
  if (intentResult.isFailure()) {
    // Compensation: release inventory
    await this.catalogClient.releaseInventory(cart.items);
    return Err(new PaymentError(intentResult.error));
  }

  // Steps 6–9 (persist + clear)
  const order = await this.persistOrder(order, intentResult.value.id, cart);
  await this.clearCart(command.sessionKey);

  return Ok({ orderId: order.id, clientSecret: intentResult.value.clientSecret });
}
```

### Why No Exceptions?

- Domain logic throws exceptions → hard to test (try/catch everywhere)
- Result<T, E> makes error flow explicit
- Controllers can uniformly map all error types to HTTP status codes
- Compensation logic is synchronous, testable

---

## Stripe Webhook Idempotency + Advisory Locks

**Problem:** Webhooks can replay (customer retry, network glitch, Stripe internal retries). Processing payment.succeeded twice = double-charging.

**Solution:** Two-layer defense:
1. **UNIQUE constraint deduplication** — Stripe event ID is unique on webhook_events table
2. **PostgreSQL advisory locks** — Serialize concurrent saga steps per order

### Webhook Event Deduplication Table

```sql
-- apps/order-service/prisma/schema.prisma
model StripeWebhookEvent {
  id                String    @id @default(cuid())
  stripeEventId     String    @unique  // stripe_event_id from Stripe API
  stripeEventType   String    // e.g., "payment_intent.succeeded"
  payload           Json      // Raw Stripe event
  processedAt       DateTime?
  createdAt         DateTime  @default(now())
}
```

### Webhook Handler (Idempotent)

```typescript
// application/use-cases/payment/handle-stripe-webhook.use-case.ts
async handleWebhook(event: Stripe.Event): Promise<void> {
  // Step 1: Insert webhook event first (deduplication at DB layer)
  let webhookEvent: StripeWebhookEvent;
  try {
    webhookEvent = await this.prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        payload: event.data.object,
      },
    });
  } catch (error) {
    // UNIQUE constraint violation = replay, already processed
    if (error.code === 'P2002') { // Prisma unique constraint error
      this.logger.info('Webhook replay detected, ignoring', { stripeEventId: event.id });
      return; // Idempotent no-op
    }
    throw error;
  }

  // Step 2: Process event (with advisory lock for order)
  const orderId = (event.data.object as any).metadata?.orderId;
  if (!orderId) {
    throw new Error('Order ID missing in Stripe metadata');
  }

  // Advisory lock: serialize concurrent saga steps per order
  const lockId = this.generateLockId(orderId);
  const lockAcquired = await this.prisma.$queryRaw<[{ pg_advisory_xact_lock: null }]>`
    SELECT pg_advisory_xact_lock(${lockId})
  `;

  try {
    const result = await this.processPaymentSucceeded(orderId);
    await this.prisma.stripeWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    this.logger.error('Failed to process webhook', { webhookEvent, error });
    throw error;
  }
  // Lock released at transaction end
}

private generateLockId(orderId: string): number {
  // Convert orderId to deterministic 32-bit int for advisory lock
  return Math.abs(orderId.charCodeAt(0) * 31 ** (orderId.length - 1)) % (2 ** 31 - 1);
}
```

### Guarantees
- ✅ **Replays ignored** — stripe_event_id UNIQUE constraint
- ✅ **No double-charge** — advisory lock serializes payment processing per order
- ✅ **Concurrent orders unblocked** — lock per order, not global

### Why Advisory Locks?

| Approach | Pros | Cons |
|----------|------|------|
| **Advisory Locks** (chosen) | Application-level, don't block SELECT, fine-grained per-order | Requires converting orderId to int |
| **Row-level locks** | Native, no conversion | Blocks other operations on order row (e.g., dashboard fetch) |
| **Distributed lock service** | Flexible | Adds service dependency, complexity |

---

## Multi-Currency Design

**Philosophy:** Store prices as integer subunits (USD cents, VND đồng). NO floating-point. NO FX conversion.

### Rules

#### 1. Storage: Integer Subunits Only

```typescript
// Domain model
price: {
  unitAmount: 2999,  // $29.99 USD (2999 cents)
  currency: 'USD',
}

inventory: {
  sku_id: 'sku-123',
  price_usd_cents: 2999,  // NOT 29.99
  price_vnd_dong: 699000, // NOT 699000.00
}
```

#### 2. Client Conversion: Decimal → Subunits

```typescript
// storefront/lib/money.ts
export const toSubunits = (decimal: number, currency: string): number => {
  if (currency === 'USD') return Math.round(decimal * 100);    // $29.99 → 2999
  if (currency === 'VND') return Math.round(decimal);           // 699000 VND → 699000
  throw new Error(`Unsupported currency: ${currency}`);
};

export const toDecimal = (subunits: number, currency: string): number => {
  if (currency === 'USD') return subunits / 100;                // 2999 → 29.99
  if (currency === 'VND') return subunits;                      // 699000 → 699000
  throw new Error(`Unsupported currency: ${currency}`);
};
```

#### 3. No FX Conversion: Single-Currency Carts

```typescript
// api/cart.ts
export async function switchCurrency(newCurrency: string) {
  const currentCart = await getCart();
  if (currentCart.currency !== newCurrency) {
    // Force explicit re-add to new currency pricing
    await clearCart();
  }
  // Re-fetch pricing in new currency
}
```

### Why This Approach?

| Reason | Impact |
|--------|--------|
| **Avoids floating-point rounding errors** | 0.1 + 0.2 !== 0.3 in IEEE 754. Integer math is exact. |
| **Matches Stripe's subunit model** | Stripe API expects cents for USD, etc. Direct mapping. |
| **Simplifies database queries** | Integer comparisons are deterministic (no precision loss). |
| **No FX complexity** | Multi-region FX logic deferred (future). |

### Database Schema

```sql
sku_prices (Postgres):
  id UUID PK
  sku_id UUID FK
  currency enum('USD', 'VND')
  unitAmount integer -- subunits
  UNIQUE(sku_id, currency)

orders (Postgres):
  id UUID PK
  totalAmount integer -- subunits, matches currency
  currency enum('USD', 'VND')

cart (Redis):
  Key: cart:{sessionKey}
  Value: {
    items: [{skuId: string, quantity: number}],
    currency: 'USD'|'VND',
    ...
  }
```

### Example: Checkout with Multi-Currency

```typescript
// Order total computation (no decimals, all integers)
const orderItems = cart.items.map(item => ({
  skuId: item.skuId,
  quantity: item.quantity,
  unitAmount: skuPrice.unitAmount, // Already integer subunits
}));

const totalAmount = orderItems.reduce((sum, item) => {
  return sum + (item.unitAmount * item.quantity);
}, 0);

// Save to database
await prisma.order.create({
  data: {
    userId: command.userId,
    totalAmount,        // Integer (no decimals)
    currency: 'USD',    // Matched from cart
    items: { create: orderItems },
  },
});

// Send to Stripe (expects subunits)
const intent = await stripe.paymentIntents.create({
  amount: totalAmount,          // 2999 (cents)
  currency: 'usd',              // Lowercase for Stripe
  metadata: { orderId: order.id },
});
```

---

## Related Documentation

- [Code Standards](./code-standards.md) — Layering, testing strategy, naming conventions
- [Codebase Highlights](./codebase-highlights.md) — Pattern summaries with Q&A
- [System Architecture](./system-architecture.md) — Service topology, event flow
