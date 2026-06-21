# Code Standards & Architectural Patterns

**Purpose:** Establish consistency across hexagonal services, flat modules, and frontends. This is the "how we code" reference — read before your first PR.

---

## Core Principles

| Principle | Application | Exception |
|-----------|-------------|-----------|
| **YAGNI** (You Aren't Gonna Need It) | Only build what the spec requires; don't anticipate features | Shared utilities (logging, tracing) are pre-approved |
| **KISS** (Keep It Simple, Stupid) | Favor clarity over cleverness | Domain logic can be sophisticated; infrastructure adapters stay thin |
| **DRY** (Don't Repeat Yourself) | Extract duplicated code into shared utils | Some repetition OK if it reduces coupling (e.g., two different repo implementations) |
| **SOLID** | Single responsibility, dependency inversion in application layer | Infrastructure can be less strict (adapters are boundary code) |

---

## Layering Strategy

### Hexagonal Architecture (Auth, Catalog, Order Services ONLY)

**Rule:** Hexagonal is MANDATORY for domain-heavy services. Do NOT force it on infrastructure-heavy services (search-service, email-worker, api-gateway).

#### Layer Order (Dependency Direction: Inward Only)

```
┌─────────────────────────────────┐
│   Interfaces (HTTP, CLI, MQ)    │ Boundary layer (controllers, consumers)
├─────────────────────────────────┤
│   Application Layer             │ Orchestration (use cases, port definitions)
├─────────────────────────────────┤
│   Domain Layer                  │ Business logic (entities, value objects)
├─────────────────────────────────┤
│   Infrastructure Layer          │ Adapter implementations (Prisma, Redis, HTTP)
└─────────────────────────────────┘
```

**Dependency Rule:** Never import inward (infrastructure ← domain is FORBIDDEN). Import follows:
- Interface imports Application
- Application defines ports + interfaces; Infrastructure implements them
- Domain has NO external dependencies (not even NestJS decorators)

#### File Structure

```
apps/auth-service/src/
├── domain/
│   ├── common/
│   │   ├── result.ts              # Result<T, E> discriminated union
│   │   ├── domain-event.ts        # Base class for events
│   │   └── errors.ts              # Domain-specific errors (UserNotFound, InvalidPassword)
│   ├── user/
│   │   ├── user.aggregate.ts      # User entity (no Prisma, no decorators)
│   │   ├── user.value-object.ts   # Email (valid?), Password (rules)
│   │   └── user.repository.port.ts # Interface, no implementation
│   └── ports/
│       ├── token-signer.port.ts   # JWT signing interface
│       └── password-hasher.port.ts # Bcrypt interface
├── application/
│   ├── use-cases/
│   │   ├── register-user.use-case.ts  # RegisterUserCommand → RegisterUserResponse
│   │   ├── login.use-case.ts
│   │   └── refresh-tokens.use-case.ts
│   └── ports/
│       ├── user.repository.ts      # Interface (implementation in infrastructure)
│       └── (other port implementations as needed)
├── infrastructure/
│   ├── persistence/
│   │   └── prisma-user.repository.ts  # Implements UserRepository interface
│   ├── crypto/
│   │   ├── jose-token-signer.ts
│   │   └── bcrypt-password-hasher.ts
│   ├── auth/
│   │   └── jwt-verifier.ts         # Verify JWT from gateway
│   └── messaging/
│       └── (Auth publishes no events)
├── interfaces/
│   ├── http/
│   │   └── auth.controller.ts      # NestJS @Controller, @Post, @UseGuards
│   └── cli/
│       └── create-admin.command.ts # nest-commander seed
├── app.module.ts                   # NestJS DI container
└── main.ts                         # Bootstrap
```

**Key Folders:**

| Folder | Responsibility | Can import | Cannot import |
|--------|-----------------|-----------|---------------|
| `domain/` | Entities, value objects, business rules | Nothing (pure TS) | Infrastructure, NestJS, Prisma |
| `application/` | Use cases, port definitions, orchestration | domain/ | infrastructure/, interfaces/ |
| `infrastructure/` | Adapter implementations (Prisma, Stripe, Redis) | domain/, application/ ports | other infrastructure/ |
| `interfaces/` | HTTP controllers, CLI commands | All layers | Nothing outside interfaces/ |

---

### Flat Architecture (Search, Email Worker, API Gateway)

**Rule:** These services are infrastructure-heavy; don't force hexagonal. Keep them modular but pragmatic.

#### File Structure

```
apps/search-service/src/
├── modules/
│   ├── elasticsearch/           # ES client, indexing, alias swap
│   ├── consumer/                # RabbitMQ listener
│   ├── reindex/                 # CLI command
│   ├── search/                  # Search service (full-text, facets)
│   └── auth/                    # JWT guard
├── common/
│   ├── logger.ts                # Pino logger (from @jcool/observability)
│   └── errors.ts                # Custom exceptions
├── app.module.ts
└── main.ts
```

**No strict layering required.** Keep modules focused:
- One module = one external concern (Elasticsearch, RabbitMQ, auth)
- Avoid circular dependencies
- Use NestJS `@Module` + DI as the organizational boundary

---

## Naming Conventions

### Files
- **Pattern:** kebab-case, descriptive, self-documenting
- **Backend:** `use-case.ts`, `*.repository.ts`, `*.adapter.ts`, `*.controller.ts`, `*.service.ts`
- **Frontend:** `page.tsx`, `*.component.tsx`, `*.hook.ts`, `*.store.ts`
- **Length:** OK to be long if it clarifies purpose (e.g., `stripe-webhook-signature-verifier.ts` is better than `verifier.ts`)

### Classes/Interfaces/Types
- **Pattern:** PascalCase
- **Interfaces (domain ports):** `UserRepository`, `TokenSigner`, `PasswordHasher` (NO `IUserRepository` prefix)
- **Implementations:** `PrismaUserRepository`, `JoseTokenSigner`
- **Entities:** `User`, `Order`, `Product`
- **Value Objects:** `Email`, `Money`, `OrderStatus`
- **DTOs:** `LoginRequest`, `UserResponse`, `ProductCreateRequest`
- **Errors:** `UserNotFound extends DomainError`, `InvalidPassword extends DomainError`

### Variables & Functions
- **Pattern:** camelCase
- **Functions:** `createUser()`, `reserveInventory()`, `startCheckout()`
- **Constants:** `SNAKE_CASE` (e.g., `MAX_CART_ITEMS`, `ORDER_TIMEOUT_MS`)
- **Private fields:** `#privateField` (ES2022 syntax preferred over underscore prefix)

### Route Paths & Enum Values
- **REST routes:** kebab-case (e.g., `/api/v1/products`, `/api/v1/order-items`)
- **RabbitMQ routing keys:** dot-notation (e.g., `order.created`, `inventory.reserved`)
- **Environment vars:** SCREAMING_SNAKE_CASE (e.g., `STRIPE_SECRET_KEY`)

---

## File Size & Modularization

### Target
- **Soft limit:** 200 lines of code (LOC) per file
- **Hard limit:** 400 LOC (then must refactor)
- **Exception:** Test files, configuration files, Markdown

### When to Split

| Smell | Action | Example |
|-------|--------|---------|
| Class >200 LOC | Extract helper classes or utilities | `RegisterUserUseCase` (100 LOC) + `UserValidator` (80 LOC) |
| File with 3+ classes | Move each class to own file | One repository per file |
| Function >50 LOC with multiple concerns | Extract sub-functions | `startCheckout()` split into `snapshotCart()`, `reserveInventory()`, `createPaymentIntent()` |
| Test file >300 LOC | Split by domain concept | `order.aggregate.test.ts`, `order.repository.test.ts` |

### How to Split

1. **Identify boundaries** — What can be tested independently?
2. **Extract to new file** — Use same folder, descriptive name
3. **Update imports** — In all files that import it
4. **Verify tests pass** — No behavior changes

---

## Error Handling Pattern: Result<T, E>

**Philosophy:** Domain and application layers RETURN errors, they do NOT throw exceptions. Controllers map errors to HTTP status codes.

### Definition

```typescript
// domain/common/result.ts (defined per service: auth, catalog, order)
export type Result<T, E> = Success<T> | Failure<E>;

export class Success<T> {
  constructor(readonly value: T) {}
  isSuccess(): this is Success<T> { return true; }
  isFailure(): this is Failure<never> { return false; }
}

export class Failure<E> {
  constructor(readonly error: E) {}
  isSuccess(): this is Success<never> { return false; }
  isFailure(): this is Failure<E> { return true; }
}

export const Ok = <T>(value: T): Result<T, never> => new Success(value);
export const Err = <E>(error: E): Result<never, E> => new Failure(error);
```

### Domain-Level Errors

```typescript
// domain/user/user.errors.ts
export class UserNotFound extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFound';
  }
}

export class InvalidPassword extends Error {
  constructor() {
    super('Password does not meet requirements');
    this.name = 'InvalidPassword';
  }
}

export type UserError = UserNotFound | InvalidPassword;
```

### Use Case (Application Layer)

```typescript
// application/register-user.use-case.ts
export class RegisterUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private passwordHasher: PasswordHasher,
  ) {}

  async execute(
    command: RegisterUserCommand,
  ): Promise<Result<UserResponse, UserError>> {
    // Validate password
    if (!isValidPassword(command.password)) {
      return Err(new InvalidPassword());
    }

    // Check duplicate email
    const existing = await this.userRepository.findByEmail(command.email);
    if (existing) {
      return Err(new UserAlreadyExists(command.email));
    }

    // Hash password
    const hash = await this.passwordHasher.hash(command.password);

    // Create user (domain-driven)
    const user = User.create({
      email: command.email,
      name: command.name,
      passwordHash: hash,
      role: 'customer',
    });

    // Persist
    await this.userRepository.save(user);

    return Ok(user.toResponse());
  }
}
```

### Controller (Interface Layer)

```typescript
// interfaces/http/auth.controller.ts
@Post('/register')
async register(@Body() dto: RegisterUserRequest): Promise<UserResponse> {
  const result = await this.registerUserUseCase.execute(dto);

  if (result.isFailure()) {
    const error = result.error;
    if (error instanceof InvalidPassword) {
      throw new BadRequestException('Password too weak');
    }
    if (error instanceof UserAlreadyExists) {
      throw new ConflictException('Email already in use');
    }
    throw new InternalServerErrorException();
  }

  return result.value; // Success case
}
```

### Benefits
- ✅ Domain logic doesn't depend on HTTP/exceptions
- ✅ Use cases are testable with synchronous assertions (no try/catch)
- ✅ Clear error flow (discriminated union)
- ✅ Type-safe (TS ensures all error cases are handled)

---

## Testing Strategy

### Unit Tests (In-Memory Fakes, NO Mocks)

**Philosophy:** Domain logic is tested with real implementations of ports, not mocks. Use in-memory fakes instead.

#### Example: Fake User Repository

```typescript
// test/fakes/fake-user.repository.ts
export class FakeUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find(u => u.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}
```

#### Example: Fake Password Hasher

```typescript
// test/fakes/fake-password-hasher.ts
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`; // Deterministic for testing
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}
```

#### Example: Test

```typescript
// test/register-user.use-case.test.ts
describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepository: FakeUserRepository;
  let passwordHasher: FakePasswordHasher;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    passwordHasher = new FakePasswordHasher();
    useCase = new RegisterUserUseCase(userRepository, passwordHasher);
  });

  it('should register a user with valid credentials', async () => {
    const result = await useCase.execute({
      email: 'test@example.com',
      name: 'Test User',
      password: 'ValidPassword123',
    });

    expect(result.isSuccess()).toBe(true);
    expect(result.value.email).toBe('test@example.com');
  });

  it('should reject duplicate email', async () => {
    await useCase.execute({
      email: 'test@example.com',
      name: 'User 1',
      password: 'ValidPassword123',
    });

    const result = await useCase.execute({
      email: 'test@example.com',
      name: 'User 2',
      password: 'ValidPassword123',
    });

    expect(result.isFailure()).toBe(true);
    expect(result.error).toBeInstanceOf(UserAlreadyExists);
  });
});
```

### Test Structure
- **File location:** `test/` folder (mirrors src/ structure)
- **Naming:** `*.test.ts` or `*.spec.ts`
- **Framework:** Vitest (not Jest)
- **Coverage target:** Domain logic + critical paths in application layer
- **Skip:** Infrastructure layer integration tests (planned for future integration/E2E coverage)

---

## Transactional Outbox, Saga, Webhook Idempotency, Multi-Currency

**Deep pattern walkthroughs live in [Architecture Patterns](./architecture-patterns.md):**

- [Transactional Outbox](./architecture-patterns.md#transactional-outbox-pattern) — Durably publish events (mutation + outbox in one tx, poller batches)
- [Saga Orchestration](./architecture-patterns.md#saga-pattern-distributed-transaction-with-compensation) — Checkout with 10 steps + 3 compensation paths
- [Webhook Idempotency](./architecture-patterns.md#stripe-webhook-idempotency--advisory-locks) — Stripe event dedup + advisory locks
- [Multi-Currency](./architecture-patterns.md#multi-currency-design) — Integer subunits (no floats), no FX

---

## Validation: Zod Everywhere

### Domain Validation (Value Objects)

```typescript
// domain/user/user.value-object.ts
export class Email {
  private constructor(readonly value: string) {}

  static create(email: string): Result<Email, InvalidEmail> {
    if (!Email.isValid(email)) {
      return Err(new InvalidEmail(email));
    }
    return Ok(new Email(email));
  }

  private static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); // Basic check
  }
}
```

### Request Validation (HTTP Input)

```typescript
// application/register-user.use-case.ts
export const RegisterUserCommandSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1).max(100),
});
export type RegisterUserCommand = z.infer<typeof RegisterUserCommandSchema>;

// interfaces/http/auth.controller.ts
@Post('/register')
async register(
  @Body(new ZodValidationPipe(RegisterUserCommandSchema)) 
  command: RegisterUserCommand,
): Promise<UserResponse> {
  return this.registerUserUseCase.execute(command);
}
```

### Database Validation (Prisma Schema)

```sql
-- apps/auth-service/prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique // DB enforces uniqueness
  name      String
  passwordHash String
  role      String   @default("customer") // customer|admin
}
```

---

## Commit Message Conventions

**Format:** Conventional Commits (enforced by commitlint)

```
<type>(<scope>): <subject>
<blank line>
<body>
<blank line>
<footer>
```

### Type (Mandatory)
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code restructuring (no behavior change)
- `test:` — Add/update tests
- `perf:` — Performance improvement
- `build:` — Build/CI changes (Dockerfile, turbo.json, package.json)
- `ci:` — CI/CD pipeline changes (.github/workflows)
- `style:` — Code formatting (Prettier pass only; no logic changes)
- `revert:` — Revert a commit

**Forbidden in code commits:** `chore:`, `docs:` (reserved for configuration changes in `.claude/` only)

### Scope (Optional but Recommended)
Service or package name: `auth-service`, `catalog-service`, `order-service`, `storefront`, `admin`, `contracts`

### Subject (Mandatory)
- Imperative mood ("add" not "adds" or "added")
- Lowercase first letter
- No period at end
- <50 characters if possible

### Examples

```bash
git commit -m "feat(order-service): implement checkout saga with 3 compensation paths"

git commit -m "fix(api-gateway): fix JWT verification bug with ES256K keys"

git commit -m "refactor(catalog-service): extract inventory locking logic to dedicated service"

git commit -m "test(auth-service): add test for bcrypt timing-safe password verification"

git commit -m "perf(search-service): optimize ES bulk index with batch size tuning"
```

---

## Code Review Checklist

Before merging, verify:

- [ ] **Naming:** File and function names are descriptive, kebab-case (files) + camelCase (functions)
- [ ] **Layering:** Hexagonal services respect domain ← application ← infrastructure rules
- [ ] **File Size:** No file >200 LOC (unless exempted: test, config, Markdown)
- [ ] **Errors:** Use Result<T, E> pattern; no bare exceptions in use cases
- [ ] **Testing:** Domain logic has unit tests with in-memory fakes (no mocks)
- [ ] **Validation:** Input validated with Zod at boundary (HTTP, RabbitMQ consumer)
- [ ] **Secrets:** No hardcoded secrets, API keys, or credentials
- [ ] **Logging:** Structured logging via `@jcool/observability`; correlation IDs propagated
- [ ] **Formatting:** ESLint + Prettier pass
- [ ] **TypeScript:** No `any`, strict mode enabled
- [ ] **Linting:** `pnpm lint` passes
- [ ] **Typecheck:** `pnpm typecheck` passes
- [ ] **Build:** `pnpm build` passes (incremental check)
- [ ] **Tests:** `pnpm test` passes (all tests green)
- [ ] **Git:** Commit message follows Conventional Commits format
- [ ] **Comments:** Explain "why", not "what" (code explains itself)

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Fix |
|--------------|---------|-----|
| Exceptions in use cases | Domain logic bleeds to controllers; hard to test | Return Result<T, E> |
| Mocking domain ports | Tests don't exercise real business logic | Use in-memory fake implementations |
| Hardcoded secrets in code | Security risk, fails deployment | Use `.env` variables |
| `any` type in TypeScript | Defeats type safety | Explicitly type or use `unknown` + type guards |
| Large single files | Hard to navigate, high cognitive load | Split by responsibility |
| Circular module imports | Breaks build, confusing dependency graph | Use interfaces/ports to break cycles |
| Publishing events inline (not outbox) | Events lost if service crashes | Outbox + poller pattern |
| Re-fetching cart from DB per request | Latency spike | Redis session-based cart |
| Storing prices as floats | Rounding errors, Stripe mismatch | Integer subunits only |
| No correlation IDs | Impossible to trace request across services | Use `@jcool/observability` |

---

## Open Questions

None. Standards are stable and applied across all services.
