import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/index.js';
import { createPrismaMetricsMiddleware } from '@jcool/observability';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.$use(createPrismaMetricsMiddleware() as any);
      await this.$connect();
    } catch (error) {
      this.logger.warn(
        `Prisma initial $connect failed; queries will lazy-reconnect: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
