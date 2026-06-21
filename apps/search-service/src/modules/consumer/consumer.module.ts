import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { RabbitMqConnectionService } from './rabbitmq-connection.service.js';
import { ProductDocumentIndexerService } from './product-document-indexer.service.js';
import { ProductIndexedConsumer } from './product-indexed.consumer.js';

@Module({
  imports: [ElasticsearchModule, CatalogModule],
  providers: [
    RabbitMqConnectionService,
    ProductDocumentIndexerService,
    ProductIndexedConsumer,
  ],
  exports: [ProductDocumentIndexerService],
})
export class ConsumerModule {}
