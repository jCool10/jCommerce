import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElasticsearchClientService.name);
  private client: Client | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const node = this.config.get<string>('ELASTICSEARCH_URL') ?? 'http://localhost:9200';
    this.client = new Client({ node, requestTimeout: 10_000, maxRetries: 2 });
    try {
      await this.client.ping();
      this.logger.log(`Connected to Elasticsearch at ${node}`);
    } catch (error) {
      this.logger.warn(
        `Elasticsearch unreachable at boot (${(error as Error).message}); will retry on demand`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }

  get raw(): Client {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialised — onModuleInit has not run');
    }
    return this.client;
  }
}
