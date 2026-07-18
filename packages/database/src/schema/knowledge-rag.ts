/**
 * RAG 知识库表 (等价自 v1.0.2-sealed: server/app/models/knowledge_models.py)
 * - zhs_knowledge_doc    知识文档
 * - zhs_knowledge_chunk  文档切片 (含向量)
 *
 * 与 knowledge-base.ts (CMS 文章) 不同,本表用于 RAG 语义检索。
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
} from 'drizzle-orm/pg-core'

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
    embedding: text('embedding'),
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
