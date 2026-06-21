import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@jcool/observability';
import { ElasticsearchModule } from './modules/elasticsearch/elasticsearch.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { ConsumerModule } from './modules/consumer/consumer.module.js';
import { ReindexModule } from './modules/reindex/reindex.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ObservabilityModule.forRoot({ service: 'search-service' }),
    ElasticsearchModule,
    CatalogModule,
    AuthModule,
    SearchModule,
    ConsumerModule,
    ReindexModule,
  ],
})
export class AppModule {}
