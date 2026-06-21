import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/index.js';
import { createPrismaMetricsMiddleware } from '@jcool/observability';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.$use(createPrismaMetricsMiddleware() as any);
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
