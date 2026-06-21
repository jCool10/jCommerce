import { Module } from '@nestjs/common';
import { ElasticsearchClientService } from './elasticsearch-client.service.js';
import { IndexAliasManagerService } from './index-alias-manager.service.js';

@Module({
  providers: [ElasticsearchClientService, IndexAliasManagerService],
  exports: [ElasticsearchClientService, IndexAliasManagerService],
})
export class ElasticsearchModule {}
