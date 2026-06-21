import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ConsumerModule } from '../consumer/consumer.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ReindexService } from './reindex.service.js';
import { ReindexController } from './reindex.controller.js';
import { ReindexCommand } from './reindex.command.js';

@Module({
  imports: [ElasticsearchModule, CatalogModule, ConsumerModule, AuthModule],
  controllers: [ReindexController],
  providers: [ReindexService, ReindexCommand],
  exports: [ReindexService, ReindexCommand],
})
export class ReindexModule {}
