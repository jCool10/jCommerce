import { Injectable } from '@nestjs/common';
import { ElasticsearchClientService } from '../elasticsearch/elasticsearch-client.service.js';
import { IndexAliasManagerService } from '../elasticsearch/index-alias-manager.service.js';
import type { ProductDocument } from './product-document.js';

export interface AutocompleteSuggestion {
  productId: string;
  name: string;
  slug: string;
}

const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 10;

@Injectable()
export class AutocompleteService {
  constructor(
    private readonly es: ElasticsearchClientService,
    private readonly alias: IndexAliasManagerService,
  ) {}

  async suggest(q: string): Promise<AutocompleteSuggestion[]> {
    const term = q.trim();
    if (term.length < MIN_QUERY_LENGTH) return [];

    const res = await this.es.raw.search<ProductDocument>({
      index: this.alias.alias,
      size: 0,
      suggest: {
        product_suggest: {
          prefix: term.toLowerCase(),
          completion: {
            field: 'suggest',
            size: MAX_SUGGESTIONS,
            skip_duplicates: true,
            fuzzy: { fuzziness: 'AUTO' },
          },
        },
      },
    });

    const suggestion = res.suggest?.product_suggest;
    if (!Array.isArray(suggestion) || suggestion.length === 0) return [];

    const options = suggestion[0]?.options;
    if (!Array.isArray(options)) return [];

    const completionOptions = options as Array<{ _source?: ProductDocument }>;
    return completionOptions
      .filter((opt): opt is { _source: ProductDocument } => opt._source !== undefined)
      .map((opt) => ({
        productId: opt._source.productId,
        name: opt._source.name,
        slug: opt._source.slug,
      }));
  }
}
