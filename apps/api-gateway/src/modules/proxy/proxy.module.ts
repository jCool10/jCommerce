import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PROXY_HTTP_REQUEST,
  PROXY_OPTIONS,
  ProxyService,
  type ProxyOptions,
} from './proxy.service.js';
import { ProxyController } from './proxy.controller.js';
import { ServiceRegistry, serviceRegistryFromConfig } from './service-registry.js';
import { undiciHttpRequest } from './undici-http-request.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ProxyController],
  providers: [
    {
      provide: ServiceRegistry,
      inject: [ConfigService],
      useFactory: serviceRegistryFromConfig,
    },
    {
      provide: PROXY_HTTP_REQUEST,
      useValue: undiciHttpRequest,
    },
    {
      provide: PROXY_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ProxyOptions => ({
        headersTimeoutMs: Number(config.get('PROXY_HEADERS_TIMEOUT_MS') ?? 10000),
        bodyTimeoutMs: Number(config.get('PROXY_BODY_TIMEOUT_MS') ?? 30000),
      }),
    },
    ProxyService,
  ],
  exports: [ProxyService, PROXY_OPTIONS],
})
export class ProxyModule {}
