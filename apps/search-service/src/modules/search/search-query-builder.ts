import type { SearchQuery } from '@jcool/contracts';
import type {
  AggregationsAggregationContainer,
  QueryDslQueryContainer,
  SearchRequest,
  SortCombinations,
} from '@elastic/elasticsearch/lib/api/types.js';

/**
 * Pure function: turns the validated SearchQuery DTO into an ES search request.
 * Kept side-effect free so it can be unit-tested without a running cluster.
 */
export function buildSearchRequest(index: string, query: SearchQuery): SearchRequest {
  const currency = query.currency ?? 'USD';
  const priceField = currency === 'USD' ? 'priceUsd' : 'priceVnd';

  const must: QueryDslQueryContainer[] = [];
  if (query.q.trim().length > 0) {
    must.push({
      multi_match: {
        query: query.q,
        fields: ['name^3', 'description'],
        fuzziness: 'AUTO',
        operator: 'and',
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  const filter: QueryDslQueryContainer[] = [{ term: { isActive: true } }];
  if (query.categoryId) {
    filter.push({ term: { categoryId: query.categoryId } });
  }
  const priceRange = buildPriceRange(query);
  if (priceRange) {
    filter.push({ range: { [priceField]: priceRange } });
  }

  const sort = buildSort(query.sort, priceField);
  const aggs: Record<string, AggregationsAggregationContainer> = {
    categories: { terms: { field: 'categoryId', size: 20 } },
    inStock: { terms: { field: 'inStock' } },
    priceStats: { stats: { field: priceField } },
  };

  const from = (query.page - 1) * query.pageSize;
  return {
    index,
    from,
    size: query.pageSize,
    query: { bool: { must, filter } },
    sort,
    aggs,
    track_total_hits: true,
  };
}

function buildPriceRange(
  query: SearchQuery,
): { gte?: number; lte?: number } | null {
  const range: { gte?: number; lte?: number } = {};
  if (query.minPrice !== undefined) range.gte = query.minPrice;
  if (query.maxPrice !== undefined) range.lte = query.maxPrice;
  return Object.keys(range).length > 0 ? range : null;
}

function buildSort(
  sort: SearchQuery['sort'],
  priceField: string,
): SortCombinations[] {
  switch (sort) {
    case 'price_asc':
      return [{ [priceField]: { order: 'asc', missing: '_last' } }];
    case 'price_desc':
      return [{ [priceField]: { order: 'desc', missing: '_last' } }];
    case 'newest':
      return [{ indexedAt: { order: 'desc' } }];
    case 'relevance':
    default:
      return ['_score'];
  }
}
