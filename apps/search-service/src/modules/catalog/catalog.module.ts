import { Module } from '@nestjs/common';
import { CatalogHttpClient } from './catalog-http-client.service.js';

@Module({
  providers: [CatalogHttpClient],
  exports: [CatalogHttpClient],
})
export class CatalogModule {}
