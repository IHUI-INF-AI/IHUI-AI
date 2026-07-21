/**
 * 知识图谱表(G5 - 2026-07-21)
 *
 * - zhs_knowledge_entity  实体(由 LLM NER 抽取,或人工录入)
 * - zhs_knowledge_relation 关系(实体之间的有向关联,带类型/权重/描述)
 *
 * 设计原则:
 * - 不存 embedding(查询时走 RAG 文档元数据关联,避免重复存储)
 * - entity(name, type) 用 unique 约束防止重复入库
 * - relation(source, target, type) 唯一约束防重复边
 * - docIds 数组存该实体关联的 RAG doc_id(JSON 数组),用于反向追溯来源
 *
 * 2026-07-21:为支持"用户上传文档 → 自动构建图谱"流程新建。
 */
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const knowledgeEntity = pgTable(
  'zhs_knowledge_entity',
  {
    id: serial('id').primaryKey(),
    ownerUuid: varchar('owner_uuid', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // person / org / concept / location / event / other
    description: text('description'),
    /** 出现频次(被抽取到多少次) */
    frequency: integer('frequency').default(1).notNull(),
    /** 关联的 RAG 文档 id 列表(JSON 数组) */
    docIds: jsonb('doc_ids').$type<number[]>().default([]).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerNameTypeUnique: uniqueIndex('ux_knowledge_entity_owner_name_type').on(
      t.ownerUuid,
      t.name,
      t.type,
    ),
    ownerIdx: index('ix_knowledge_entity_owner').on(t.ownerUuid),
    typeIdx: index('ix_knowledge_entity_type').on(t.type),
  }),
)

export const knowledgeRelation = pgTable(
  'zhs_knowledge_relation',
  {
    id: serial('id').primaryKey(),
    ownerUuid: varchar('owner_uuid', { length: 64 }).notNull(),
    sourceEntityId: integer('source_entity_id').notNull(),
    targetEntityId: integer('target_entity_id').notNull(),
    /** 关系类型(works_for / located_in / part_of / related_to / etc) */
    relationType: varchar('relation_type', { length: 50 }).notNull(),
    description: text('description'),
    /** 关系权重(被抽取到多少次,影响前端图谱边的粗细) */
    weight: numeric('weight').default('1').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    edgeUnique: uniqueIndex('ux_knowledge_relation_edge').on(
      t.ownerUuid,
      t.sourceEntityId,
      t.targetEntityId,
      t.relationType,
    ),
    ownerIdx: index('ix_knowledge_relation_owner').on(t.ownerUuid),
    sourceIdx: index('ix_knowledge_relation_source').on(t.sourceEntityId),
    targetIdx: index('ix_knowledge_relation_target').on(t.targetEntityId),
  }),
)

export type KnowledgeEntity = typeof knowledgeEntity.$inferSelect
export type KnowledgeEntityInsert = typeof knowledgeEntity.$inferInsert
export type KnowledgeRelation = typeof knowledgeRelation.$inferSelect
export type KnowledgeRelationInsert = typeof knowledgeRelation.$inferInsert
