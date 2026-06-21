import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/index.js';
import { createPrismaMetricsMiddleware } from '@jcool/observability';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // Records `db_query_duration_seconds{operation,table}` for every query.
    // Cast: Prisma's $use middleware signature uses internal generic shapes,
    // ours is a structural-equivalent middleware so the cast is safe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.$use(createPrismaMetricsMiddleware() as any);
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
