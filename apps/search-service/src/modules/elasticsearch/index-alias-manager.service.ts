import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchClientService } from './elasticsearch-client.service.js';
import {
  PRODUCT_INDEX_ALIAS_DEFAULT,
  PRODUCT_INDEX_MAPPING,
  PRODUCT_INDEX_SETTINGS,
} from './product-index-mapping.js';

interface AliasState {
  alias: string;
  liveIndex: string | null;
}

/**
 * Owns lifecycle of the `products` alias and underlying versioned indexes
 * (`products-v1`, `products-v2`, ...). Atomic alias swap = zero-downtime reindex.
 */
@Injectable()
export class IndexAliasManagerService {
  private readonly logger = new Logger(IndexAliasManagerService.name);

  constructor(
    private readonly es: ElasticsearchClientService,
    private readonly config: ConfigService,
  ) {}

  get alias(): string {
    return this.config.get<string>('ES_INDEX_ALIAS') ?? PRODUCT_INDEX_ALIAS_DEFAULT;
  }

  /** Index version used as the live target on first boot. */
  get defaultVersion(): string {
    return this.config.get<string>('ES_INDEX_VERSION') ?? 'v1';
  }

  /**
   * Idempotent: ensures the alias exists and points at a real index with the latest mapping.
   * Returns the live index name (e.g. `products-v1`).
   */
  async ensureAlias(): Promise<string> {
    const state = await this.currentAliasState();
    if (state.liveIndex) {
      return state.liveIndex;
    }
    const indexName = `${state.alias}-${this.defaultVersion}`;
    await this.createIndex(indexName);
    await this.es.raw.indices.putAlias({ index: indexName, name: state.alias });
    this.logger.log(`Created index ${indexName} and alias ${state.alias}`);
    return indexName;
  }

  async currentAliasState(): Promise<AliasState> {
    const alias = this.alias;
    try {
      const res = await this.es.raw.indices.getAlias({ name: alias });
      const indexes = Object.keys(res);
      return { alias, liveIndex: indexes[0] ?? null };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404) return { alias, liveIndex: null };
      throw error;
    }
  }

  /**
   * Provisions a new empty index named after the next available version, returns its name.
   * Caller is expected to bulk-index into it, then call `swapAliasTo()` once full.
   *
   * Idempotent across crash recovery: scans all `<alias>-v*` indexes — not just the live one —
   * so an orphan from a previously-aborted reindex (created but never swapped) is bumped past
   * instead of re-creating and 400ing.
   */
  async createNextIndex(): Promise<string> {
    const state = await this.currentAliasState();
    const existing = await this.listExistingVersions();
    const defaultFloor = (this.versionOf(`x-${this.defaultVersion}`) ?? 1) - 1;
    const highest = Math.max(this.versionOf(state.liveIndex) ?? 0, defaultFloor, ...existing);
    const nextVersion = `v${highest + 1}`;
    const indexName = `${state.alias}-${nextVersion}`;
    await this.createIndex(indexName);
    return indexName;
  }

  private async listExistingVersions(): Promise<number[]> {
    try {
      const res = await this.es.raw.indices.get({
        index: `${this.alias}-v*`,
        allow_no_indices: true,
        expand_wildcards: 'open',
      });
      return Object.keys(res)
        .map((name) => this.versionOf(name))
        .filter((v): v is number => v !== null);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404) return [];
      throw error;
    }
  }

  private versionOf(indexName: string | null): number | null {
    if (!indexName) return null;
    const match = indexName.match(/-v(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  /**
   * Atomic swap: alias moves off the old index (if any) onto `newIndex` in one call.
   * Old index left intact for caller to delete after success.
   */
  async swapAliasTo(newIndex: string): Promise<{ removed: string | null }> {
    const state = await this.currentAliasState();
    const actions: Array<Record<string, unknown>> = [];
    if (state.liveIndex && state.liveIndex !== newIndex) {
      actions.push({ remove: { index: state.liveIndex, alias: state.alias } });
    }
    actions.push({ add: { index: newIndex, alias: state.alias } });
    await this.es.raw.indices.updateAliases({ actions });
    this.logger.log(
      `Alias ${state.alias} swapped to ${newIndex} (removed: ${state.liveIndex ?? 'none'})`,
    );
    return { removed: state.liveIndex && state.liveIndex !== newIndex ? state.liveIndex : null };
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.es.raw.indices.delete({ index: indexName });
      this.logger.log(`Deleted old index ${indexName}`);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status !== 404) throw error;
    }
  }

  private async createIndex(indexName: string): Promise<void> {
    await this.es.raw.indices.create({
      index: indexName,
      settings: PRODUCT_INDEX_SETTINGS,
      mappings: PRODUCT_INDEX_MAPPING,
    });
  }
}
