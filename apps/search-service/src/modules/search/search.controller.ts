import { Controller, Get, Query } from '@nestjs/common';
import type { SearchResponse } from '@jcool/contracts';
import { ZodValidationPipe } from '@jcool/nest-kit';
import { SearchService } from './search.service.js';
import {
  AutocompleteService,
  type AutocompleteSuggestion,
} from './autocomplete.service.js';
import {
  AutocompleteQuerySchema,
  type AutocompleteQuery,
} from './autocomplete-query.dto.js';
import {
  SearchQueryRequestSchema,
  type SearchQueryRequest,
} from './search-query-request.dto.js';

@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly autocompleteService: AutocompleteService,
  ) {}

  @Get()
  async search(
    @Query(new ZodValidationPipe(SearchQueryRequestSchema)) query: SearchQueryRequest,
  ): Promise<SearchResponse> {
    return this.searchService.search(query);
  }

  @Get('autocomplete')
  async autocomplete(
    @Query(new ZodValidationPipe(AutocompleteQuerySchema)) query: AutocompleteQuery,
  ): Promise<{ suggestions: AutocompleteSuggestion[] }> {
    const suggestions = await this.autocompleteService.suggest(query.q);
    return { suggestions };
  }
}
