# Senior-Judgment Code Highlights

**Six patterns that demonstrate expertise in distributed systems, error handling, and architectural resilience. Read in this order before reviewing code.**

---

## ⭐ #1: Deadlock-Free Concurrent Reservation

**File:** `apps/catalog-service/src/infrastructure/persistence/prisma-inventory.repository.ts`

**Problem:** Concurrent checkout requests hitting the same SKU can deadlock or double-allocate inventory.

**Solution:** Use PostgreSQL `SELECT ... FOR UPDATE` with ordered locking + UNIQUE constraint on reservations. If replication attempt conflicts, insertion fails safely (idempotent).

**Key Pattern:**
```sql
SELECT * FROM inventory WHERE sku_id IN (...) FOR UPDATE;
-- Verify available >= qty per SKU
INSERT INTO reservations (order_id, sku_id, quantity) VALUES (...);
-- UNIQUE constraint makes re-insertion safe (returns existing row)
UPDATE inventory SET available = available - qty, reserved = reserved + qty;
```

**Q to answer:** "Why SELECT ... FOR UPDATE instead of a Lua script or application-level lock?"
- Lua adds distributed system complexity
- Application-level lock requires coordination service
- FOR UPDATE is built into PostgreSQL, atomic, and respects transaction scope

---

## ⭐ #2: Saga Orchestration + Compensation Paths

**File:** `apps/order-service/src/application/use-cases/saga/start-checkout.use-case.ts`

**Problem:** Checkout is a distributed transaction (catalog reserve, Stripe payment, email). If step 5 (Stripe) fails, prior steps must roll back.

**Solution:** 10 happy-path steps with 3 compensation (rollback) paths. No exceptions thrown—use Result<T, E> pattern.

**The 10 Steps:**
1. Snapshot cart from Redis
2. Fetch SKU prices from catalog
3. Build Order + items, compute total
4. Reserve inventory via catalog POST /inventory/reserve (sync)
5. Create Stripe PaymentIntent (idempotency key = orderId)
6. Attach intent ID to order
7. Save order + outbox event in one Prisma transaction
8. Clear cart
9. Return {orderId, clientSecret}
10. ✅ Success: order now PENDING

**Compensation Paths:**
- If step 4 fails: cancel order (no release needed, reservation never happened)
- If step 5 fails: release inventory + cancel order
- If step 7 fails: release inventory + cancel PaymentIntent + cancel order

**Q to answer:** "Walk me through what happens if Stripe fails at step 5."
- Step 5 fails → return Err(StripeError)
- Controller catches error → runs compensation (release inventory + cancel order)
- User sees error "Payment could not be processed" + order is CANCELLED

---

## ⭐ #3: Stripe Webhook Idempotency + Advisory Locks

**Files:**
- `apps/order-service/src/application/use-cases/payment/handle-stripe-webhook.use-case.ts` (idempotency + advisory locks)
- `apps/order-service/src/infrastructure/persistence/prisma-webhook-event.repository.ts` (webhook dedup table)
- `apps/order-service/src/infrastructure/stripe/stripe-signature-verifier.adapter.ts` (HMAC verification)

**Problem:** Webhooks can replay (customer retry, network glitch, Stripe retry logic). Processing payment.succeeded twice = double-charging.

**Solution:** Two-layer defense:
1. **UNIQUE constraint deduplication** — stripe_event_id UNIQUE on webhook_events table. First insertion wins; replays fail silently.
2. **PostgreSQL advisory locks** — Per-order lock serializes concurrent saga steps. Prevents race where two webhooks process same order simultaneously.

**Flow:**
```typescript
// Step 1: Insert webhook event (deduplication)
try {
  const webhookEvent = await prisma.stripeWebhookEvent.create({
    data: { stripeEventId: event.id, stripeEventType: event.type, payload: event.data }
  });
} catch (error) {
  if (error.code === 'P2002') { // UNIQUE constraint violation
    logger.info('Webhook replay detected');
    return; // Idempotent: ignore
  }
  throw error;
}

// Step 2: Acquire advisory lock per order
const lockId = generateLockId(orderId);
await prisma.$queryRaw`SELECT pg_advisory_xact_lock(${lockId})`;

// Step 3: Process (update order status, publish event)
// Lock released at transaction end
```

**Q to answer:** "Why advisory locks instead of pessimistic locking on orders table?"
- Row-level locks block other operations (e.g., fetching order for user dashboard)
- Advisory locks are application-only, don't block SELECT
- Can be released at transaction boundary, not row

---

## ⭐ #4: Transactional Outbox + Poller

**Files:**
- `apps/catalog-service/src/infrastructure/messaging/outbox-poller.cron.ts`
- `apps/order-service/src/infrastructure/messaging/outbox-poller.cron.ts`

**Problem:** Microservices must publish events durably. If service crashes after domain mutation but before publishing, event is lost. Consumers miss critical state changes.

**Solution:** Write mutation + event to database in one transaction. A background poller asynchronously publishes events. If poller crashes, next poll cycle retries.

**Flow:**

1. **Save in transaction:**
   ```typescript
   await prisma.$transaction(async (tx) => {
     const order = await tx.order.create({ data: {...} });
     await tx.outboxEvent.create({
       data: {
         routingKey: 'order.created',
         payload: { orderId: order.id, userId: order.userId, ... }
       }
     });
   });
   ```

2. **Poller (every ~1s):**
   ```typescript
   @Cron(CronExpression.EVERY_1_SECOND)
   async poll(): Promise<void> {
     const batch = await prisma.outboxEvent.findMany({
       where: { publishedAt: null },
       take: 100,
       orderBy: { createdAt: 'asc' }
     });

     for (const event of batch) {
       await rabbitmqPublisher.publish(event.routingKey, event.payload);
       await prisma.outboxEvent.update({
         where: { id: event.id },
         data: { publishedAt: new Date() }
       });
     }
   }
   ```

**Guarantees:**
- ✅ No lost events (mutation + outbox in one tx)
- ✅ At-least-once delivery (subscriber must be idempotent)
- ✅ No duplicate events (publishedAt prevents re-publishing)

**Q to answer:** "What happens if the poller crashes between SELECT and publish?"
- Event remains unpublished (publishedAt is NULL)
- Next poller cycle picks it up and retries
- At-least-once semantics (subscriber handles duplicates via Stripe webhook pattern)

---

## ⭐ #5: Event Versioning (V1/V2 Side-by-Side)

**File:** `packages/contracts/src/events/`

**Problem:** Adding a new field to an event (e.g., shipping address) breaks old consumers that don't expect it.

**Solution:** New schemas get new versions (V2 side-by-side with V1). Old handlers ignore new fields (forward-compatible). Consumers explicitly handle versions.

**Implementation:**

```typescript
// DO: Create V2 alongside V1
export const OrderCreatedV1Schema = z.object({
  version: z.literal(1),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  totalAmount: z.number().int().positive(),
  currency: z.enum(['USD', 'VND']),
});

// NEW: Adding shipping address for fulfillment service
export const OrderCreatedV2Schema = z.object({
  version: z.literal(2),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  totalAmount: z.number().int().positive(),
  currency: z.enum(['USD', 'VND']),
  shippingAddress: z.string(), // NEW FIELD
});

export type OrderCreated = OrderCreatedV1 | OrderCreatedV2;
```

**Consumer handles both versions:**
```typescript
async handleOrderCreated(event: OrderCreated): Promise<void> {
  if (event.version === 1) {
    // Old handler, ignore new fields
    await sendEmail({ orderId: event.orderId, amount: event.totalAmount });
  } else if (event.version === 2) {
    // New handler, use shipping address
    await sendEmailWithLabel({
      orderId: event.orderId,
      amount: event.totalAmount,
      address: event.shippingAddress
    });
  }
}
```

**Q to answer:** "Why not use discriminated unions or inheritance for event versions?"
- Discriminated unions make versioning implicit (harder to track)
- Inheritance couples versions tightly
- Side-by-side versions are explicit, each is fully specified, easy to deprecate V1 later

---

## ⭐ #6: Hexagonal Layering (Domain → Application → Infrastructure)

**File:** `apps/auth-service/src/` (simplest working example)

**Structure:**
```
domain/                 # Business logic (no external deps)
  ├── user.entity.ts        # User aggregate, password rules
  ├── common/result.ts       # Result<T, E> discriminated union
  └── ports/
      ├── user.repository.ts         # Interface (no impl)
      └── password-hasher.port.ts    # Interface (no impl)

application/            # Use cases (orchestration)
  ├── register-user.use-case.ts      # RegisterUserCommand → UserResponse
  ├── login.use-case.ts
  └── ports/
      └── (port implementations in infrastructure)

infrastructure/         # External integrations
  ├── persistence/prisma-user.repository.ts
  ├── crypto/bcrypt-password-hasher.ts
  └── crypto/jose-token-signer.ts

interfaces/             # Boundary (HTTP, CLI)
  ├── http/auth.controller.ts
  └── cli/seed-admin.command.ts
```

**Key Principles:**
- Domain has NO external dependencies (no Prisma, no NestJS decorators)
- Domain is testable with in-memory fakes (no database)
- Application defines ports (interfaces); infrastructure implements them
- Controllers import from application only (not infrastructure directly)

**Example: Hexagonal Test**
```typescript
// test/fakes/fake-user.repository.ts
export class FakeUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  async save(user: User): Promise<void> { this.users.set(user.id, user); }
  async findByEmail(email: string): Promise<User | null> { ... }
}

// test/register-user.use-case.test.ts
describe('RegisterUserUseCase', () => {
  it('should register user with valid password', async () => {
    const repo = new FakeUserRepository();
    const hasher = new FakePasswordHasher();
    const useCase = new RegisterUserUseCase(repo, hasher);

    const result = await useCase.execute({
      email: 'test@example.com',
      name: 'Test',
      password: 'ValidPassword123'
    });

    expect(result.isSuccess()).toBe(true);
  });
});
```

**Q to answer:** "Why is RegisterUser a separate file from the User entity?"
- Separation of concerns: entity defines structure, use case defines workflow
- Testability: use case tests orchestration logic + port interactions
- Reusability: same User entity used by login, refresh-tokens, logout use cases

---

## Related Reading

These highlights reference material in:
- [Code Standards](./code-standards.md) — layering, Result<T,E>, validation, testing strategy
- [Architecture Patterns](./architecture-patterns.md) — deep walkthroughs of outbox, saga, idempotency
- [System Architecture](./system-architecture.md) — service topology, event flow, data model
