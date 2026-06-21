import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@jcool/observability';
import { AuthController } from './interfaces/http/auth.controller.js';
import { JwtAuthGuard } from './interfaces/http/jwt-auth.guard.js';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { RefreshTokensUseCase } from './application/use-cases/refresh-tokens.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case.js';
import { USER_REPOSITORY } from './domain/ports/user.repository.js';
import { REFRESH_TOKEN_BLOCKLIST_REPOSITORY } from './domain/ports/refresh-token-blocklist.repository.js';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port.js';
import { TOKEN_SIGNER } from './application/ports/token-signer.port.js';
import { EVENT_PUBLISHER } from './application/ports/event-publisher.port.js';
import { PrismaService } from './infrastructure/persistence/prisma.service.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository.js';
import { RedisRefreshTokenBlocklistRepository } from './infrastructure/persistence/redis-refresh-token-blocklist.repository.js';
import { BcryptPasswordHasher } from './infrastructure/crypto/bcrypt-password-hasher.adapter.js';
import { JoseTokenSigner } from './infrastructure/crypto/jose-token-signer.adapter.js';
import { NoopEventPublisher } from './infrastructure/messaging/noop-event-publisher.adapter.js';
import { SeedAdminCommand } from './interfaces/cli/seed-admin.command.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ObservabilityModule.forRoot({ service: 'auth-service' }),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    JwtAuthGuard,
    SeedAdminCommand,

    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    {
      provide: REFRESH_TOKEN_BLOCKLIST_REPOSITORY,
      useClass: RedisRefreshTokenBlocklistRepository,
    },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SIGNER, useClass: JoseTokenSigner },
    { provide: EVENT_PUBLISHER, useClass: NoopEventPublisher },

    {
      provide: RegisterUserUseCase,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_SIGNER, EVENT_PUBLISHER],
      useFactory: (users, hasher, signer, events) =>
        new RegisterUserUseCase(users, hasher, signer, events),
    },
    {
      provide: LoginUseCase,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_SIGNER],
      useFactory: (users, hasher, signer) => new LoginUseCase(users, hasher, signer),
    },
    {
      provide: RefreshTokensUseCase,
      inject: [USER_REPOSITORY, TOKEN_SIGNER, REFRESH_TOKEN_BLOCKLIST_REPOSITORY],
      useFactory: (users, signer, blocklist) =>
        new RefreshTokensUseCase(users, signer, blocklist),
    },
    {
      provide: LogoutUseCase,
      inject: [TOKEN_SIGNER, REFRESH_TOKEN_BLOCKLIST_REPOSITORY],
      useFactory: (signer, blocklist) => new LogoutUseCase(signer, blocklist),
    },
    {
      provide: GetCurrentUserUseCase,
      inject: [USER_REPOSITORY],
      useFactory: (users) => new GetCurrentUserUseCase(users),
    },
  ],
})
export class AppModule {}
