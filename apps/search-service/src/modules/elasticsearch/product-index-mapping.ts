import type {
  IndicesIndexSettings,
  MappingTypeMapping,
} from '@elastic/elasticsearch/lib/api/types.js';

// Edge n-gram analyzer powers prefix/autocomplete on `name`.
// Search-time uses `standard` to avoid double-grammed query terms (recommended ES pattern).
export const PRODUCT_INDEX_SETTINGS: IndicesIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 0,
  analysis: {
    tokenizer: {
      edge_ngram_tokenizer: {
        type: 'edge_ngram',
        min_gram: 2,
        max_gram: 20,
        token_chars: ['letter', 'digit'],
      },
    },
    analyzer: {
      edge_ngram_analyzer: {
        type: 'custom',
        tokenizer: 'edge_ngram_tokenizer',
        filter: ['lowercase'],
      },
      edge_ngram_search_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase'],
      },
    },
  },
};

// Index both currency prices so query can branch on ?currency=.
// Amounts are integer subunits (cents for USD, đồng for VND) — keeps math exact.
export const PRODUCT_INDEX_MAPPING: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    productId: { type: 'keyword' },
    slug: { type: 'keyword' },
    name: {
      type: 'text',
      analyzer: 'edge_ngram_analyzer',
      search_analyzer: 'edge_ngram_search_analyzer',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
    description: { type: 'text' },
    categoryId: { type: 'keyword' },
    image: { type: 'keyword', index: false },
    isActive: { type: 'boolean' },
    priceUsd: { type: 'long' },
    priceVnd: { type: 'long' },
    inStock: { type: 'boolean' },
    suggest: {
      type: 'completion',
      analyzer: 'simple',
      preserve_separators: true,
      preserve_position_increments: true,
      max_input_length: 50,
    },
    indexedAt: { type: 'date' },
  },
};

export const PRODUCT_INDEX_ALIAS_DEFAULT = 'products';
