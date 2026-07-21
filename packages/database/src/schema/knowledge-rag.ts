/**
 * RAG 知识库表 (等价自 v1.0.2-sealed: server/app/models/knowledge_models.py)
 * - zhs_knowledge_doc    知识文档
 * - zhs_knowledge_chunk  文档切片 (含向量,pgvector 1536 维)
 *
 * 与 knowledge-base.ts (CMS 文章) 不同,本表用于 RAG 语义检索。
 *
 * 2026-07-21:embedding 从 text(JSON 字符串)迁移到 pgvector vector(1536) 字段,
 * 配套 migration 0123_pgvector_embedding.sql。
 * 2026-07-21:配套 HNSW 索引 vector_cosine_ops,在 service 层用 SQL `<=>` 距离运算。
 */
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  numeric,
  index,
  customType,
} from 'drizzle-orm/pg-core'

/**
 * pgvector 类型 Drizzle 适配(drizzle-orm 0.38 原生 vector 类型未稳定)。
 *
 * - dataType()  → 列定义 vector(1536)
 * - toDriver()  → 写入时把 number[] 序列化为 Postgres array literal '[0.1,0.2,...]'
 * - fromDriver()→ 读取时把 Postgres 字符串 '[0.1,0.2]' 解析回 number[]
 */
export const vector1536 = customType<{
  data: number[] | null
  driverData: string | null
}>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[] | null): string | null {
    if (value === null || value === undefined) return null
    if (!Array.isArray(value)) {
      throw new Error('vector1536.toDriver: value must be number[]')
    }
    if (value.length !== 1536) {
      throw new Error(
        `vector1536.toDriver: dimension mismatch, expected 1536 got ${value.length}`,
      )
    }
    return `[${value.join(',')}]`
  },
  fromDriver(value: string | null): number[] | null {
    if (value === null || value === undefined) return null
    // pgvector 驱动返回 '[0.1,0.2,...]' 格式
    const trimmed = value.replace(/^\[/, '').replace(/\]$/, '')
    if (!trimmed) return null
    const parts = trimmed.split(',')
    const out = new Array<number>(parts.length)
    for (let i = 0; i < parts.length; i++) {
      const n = Number(parts[i])
      if (Number.isNaN(n)) return null
      out[i] = n
    }
    return out
  },
})

export const knowledgeDoc = pgTable(
  'zhs_knowledge_doc',
  {
    id: serial('id').primaryKey(),
    ownerUuid: varchar('owner_uuid', { length: 64 }).notNull(),
    collectionName: varchar('collection_name', { length: 100 }).default('default').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    sourceType: varchar('source_type', { length: 20 }).default('text').notNull(),
    sourcePath: varchar('source_path', { length: 500 }),
    contentHash: varchar('content_hash', { length: 64 }),
    chunkCount: integer('chunk_count').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('ix_knowledge_doc_owner').on(t.ownerUuid),
    collIdx: index('ix_knowledge_doc_collection').on(t.collectionName),
  }),
)

export const knowledgeChunk = pgTable(
  'zhs_knowledge_chunk',
  {
    id: serial('id').primaryKey(),
    docId: integer('doc_id').notNull(),
    collectionName: varchar('collection_name', { length: 100 }).default('default').notNull(),
    ownerUuid: varchar('owner_uuid', { length: 64 }).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    /** pgvector 1536 维向量;NULL 时降级为关键词检索 */
    embedding: vector1536('embedding'),
    score: numeric('score').default('0').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    docIdx: index('ix_knowledge_chunk_doc_id').on(t.docId),
    collIdx: index('ix_knowledge_chunk_collection').on(t.collectionName),
  }),
)

export type KnowledgeDoc = typeof knowledgeDoc.$inferSelect
export type KnowledgeChunk = typeof knowledgeChunk.$inferSelect
