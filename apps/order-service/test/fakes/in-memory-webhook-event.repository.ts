import type {
  WebhookEventRecord,
  WebhookEventRepository,
} from '../../src/domain/ports/webhook-event.repository.js';

export class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly seen = new Set<string>();
  readonly records: WebhookEventRecord[] = [];

  async recordIfNew(record: WebhookEventRecord): Promise<boolean> {
    if (this.seen.has(record.stripeEventId)) return false;
    this.seen.add(record.stripeEventId);
    this.records.push(record);
    return true;
  }
}
