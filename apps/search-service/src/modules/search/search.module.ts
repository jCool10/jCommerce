import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import { AutocompleteService } from './autocomplete.service.js';

@Module({
  imports: [ElasticsearchModule],
  controllers: [SearchController],
  providers: [SearchService, AutocompleteService],
  exports: [SearchService, AutocompleteService],
})
export class SearchModule {}
