import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CurrencySchema,
  type Currency,
  type Facet,
  type SearchHit,
  type SearchQuery,
  type SearchResponse,
} from '@jcool/contracts';
import type {
  AggregationsAggregate,
  SearchHit as EsSearchHit,
} from '@elastic/elasticsearch/lib/api/types.js';
import { ElasticsearchClientService } from '../elasticsearch/elasticsearch-client.service.js';
import { IndexAliasManagerService } from '../elasticsearch/index-alias-manager.service.js';
import type { ProductDocument } from './product-document.js';
import { buildSearchRequest } from './search-query-builder.js';

interface TermsBucket {
  key: string | number | boolean;
  doc_count: number;
}

interface StatsAgg {
  count: number;
  min: number | null;
  max: number | null;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly es: ElasticsearchClientService,
    private readonly alias: IndexAliasManagerService,
    private readonly config: ConfigService,
  ) {}

  private get defaultCurrency(): Currency {
    const raw = this.config.get<string>('DEFAULT_CURRENCY') ?? 'USD';
    const parsed = CurrencySchema.safeParse(raw);
    return parsed.success ? parsed.data : 'USD';
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const currency: Currency = query.currency ?? this.defaultCurrency;
    const effectiveQuery: SearchQuery = { ...query, currency };
    const req = buildSearchRequest(this.alias.alias, effectiveQuery);
    const res = await this.es.raw.search<ProductDocument>(req);

    const hits = res.hits.hits.map((hit) => toSearchHit(hit, currency));
    const facets = toFacets(res.aggregations ?? {});
    const total =
      typeof res.hits.total === 'number' ? res.hits.total : (res.hits.total?.value ?? 0);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      hits,
      facets,
    };
  }
}

function toSearchHit(hit: EsSearchHit<ProductDocument>, currency: Currency): SearchHit {
  const src = hit._source;
  if (!src) {
    throw new Error(`Elasticsearch hit ${hit._id} returned without _source`);
  }
  const amount = currency === 'USD' ? src.priceUsd : src.priceVnd;
  return {
    productId: src.productId,
    slug: src.slug,
    name: src.name,
    image: src.image ?? undefined,
    fromPrice: {
      currency,
      amount: amount ?? 0,
    },
  };
}

function toFacets(aggregations: Record<string, AggregationsAggregate>): Facet[] {
  const facets: Facet[] = [];

  const categories = aggregations.categories as { buckets?: TermsBucket[] } | undefined;
  if (categories?.buckets) {
    facets.push({
      field: 'categoryId',
      buckets: categories.buckets.map((b) => ({
        key: String(b.key),
        count: b.doc_count,
      })),
    });
  }

  const inStock = aggregations.inStock as { buckets?: TermsBucket[] } | undefined;
  if (inStock?.buckets) {
    facets.push({
      field: 'inStock',
      buckets: inStock.buckets.map((b) => ({
        key: String(b.key),
        count: b.doc_count,
      })),
    });
  }

  const priceStats = aggregations.priceStats as StatsAgg | undefined;
  if (priceStats && priceStats.count > 0) {
    facets.push({
      field: 'priceRange',
      buckets: [
        { key: 'min', count: priceStats.min ?? 0 },
        { key: 'max', count: priceStats.max ?? 0 },
      ],
    });
  }

  return facets;
}
