import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ObservabilityModule } from '@jcool/observability';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard.js';
import { CorrelationMiddleware } from './modules/correlation/correlation.middleware.js';
import { GatewayErrorFilter } from './modules/errors/error-filter.js';
import { ProxyModule } from './modules/proxy/proxy.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { buildThrottlerOptions } from './modules/throttler/throttler.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ObservabilityModule.forRoot({ service: 'api-gateway' }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildThrottlerOptions,
    }),
    AuthModule,
    ProxyModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: GatewayErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
