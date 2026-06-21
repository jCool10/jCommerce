import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import type {
  WebhookEventRecord,
  WebhookEventRepository,
} from '../../domain/ports/webhook-event.repository.js';
import { PrismaService } from './prisma.service.js';

/**
 * Prisma-backed idempotency table. UNIQUE on `stripe_event_id` collapses
 * duplicate webhook deliveries (Stripe retries on non-2xx) into a single
 * row. P2002 (unique violation) is the signal for "already processed".
 */
@Injectable()
export class PrismaWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordIfNew(record: WebhookEventRecord): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          stripeEventId: record.stripeEventId,
          type: record.type,
          payload: record.payload as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }
}
