/**
 * VectorSearch — embedding 语义检索统一封装,cosine similarity 排序。
 * 平台独占:仅 cli(W2-1 向量语义层,对标 OpenClaw Mem semantic retrieval)。
 * 复用 embedding.ts(EmbeddingProvider)+ hybrid-search.ts(cosineSimilarity),零冗余。
 */
import * as crypto from 'node:crypto';
import type { EmbeddingProvider } from './embedding.js';
import { cosineSimilarity } from './hybrid-search.js';

export interface VectorSearchEntry {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  entry: VectorSearchEntry;
  /** cosine similarity,[-1, 1],越大越相关 */
  score: number;
}

export class VectorSearch {
  private readonly entries: VectorSearchEntry[] = [];
  private readonly provider: EmbeddingProvider;

  constructor(provider: EmbeddingProvider) {
    this.provider = provider;
  }

  /** 添加文本(自动 embedding),返回条目(含生成的 id)。 */
  async add(text: string, metadata?: Record<string, unknown>): Promise<VectorSearchEntry> {
    const embeddings = await this.provider.embedBatch([text]);
    const emb = embeddings[0];
    if (!emb) {
      throw new Error('embedding provider returned empty result');
    }
    const entry: VectorSearchEntry = {
      id: crypto.randomUUID(),
      text,
      embedding: emb,
      metadata,
    };
    this.entries.push(entry);
    return entry;
  }

  /** 语义检索:对 query embedding 与全部条目做 cosine 相似度排序,返回 top limit。 */
  async search(query: string, limit = 5): Promise<VectorSearchResult[]> {
    if (this.entries.length === 0) return [];
    const embeddings = await this.provider.embedBatch([query]);
    const queryEmb = embeddings[0];
    if (!queryEmb) return [];
    const scored = this.entries.map((entry) => ({
      entry,
      score: cosineSimilarity(queryEmb, entry.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(1, limit));
  }

  /** 当前索引条目数。 */
  get size(): number {
    return this.entries.length;
  }

  /** 清空索引。 */
  clear(): void {
    this.entries.length = 0;
  }
}
