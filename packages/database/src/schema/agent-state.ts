// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Agent 持久化状态表(2026-07-25 立,L2-L9 记忆/元学习/多模态/A-B 测试等)。
 *
 * 全部由 apps/ai-service(Python,FastAPI)以 raw SQL 读写,作为各内存管理器
 * (MemoryDecayManager / UserProfileBuilder / MetaLearner / FederatedLearner /
 *  MultimodalMemory / SessionSummarizer / Metacognition / ABTestTracker)的持久化镜像。
 * 此处补 TS schema 定义以消除 check-db-schema-drift 的 dead migration 告警,
 * 并保持 packages/database 单一数据源的表名 ↔ migration 一致性。
 *
 * ⚠ 2026-10-18 双轨对齐(根治 31 条 schema_check「字段类型不匹配」WARNING):
 *   drizzle/20260725120000~20260725190000 这 8 份手写 migration 声明了本组 9 表,
 *   但**从未进入 _journal.json、从未在 __drizzle_migrations 记账**;库里这 9 张表的
 *   真实结构由别的途径长成(agent_meta_lessons 由 apps/ai-service meta_learner
 *   自愈建表定形),本文件是后来照 migration 文案补的镜像,从未与库对账。
 *   本轮以「库里实际结构」为唯一事实源重写(收敛迁移见
 *   drizzle/20261018160000_agent_state_tables_runtime_reality.sql):
 *     · 列名/类型/nullability/default 逐列对齐 information_schema 现状
 *     · bigint 自增主键用 bigserial(mode:'number'),double precision 用 doublePrecision
 *     · varchar(n) 的长度按库实测(32/64),不是照 migration 文案
 *     · DB 有而旧镜像没声明的列(user_id / anonymized_content /
 *       source_user_ids_hash / dp_noise_added / content_bytes)已补声明,
 *       并在收敛迁移里补 ADD COLUMN 给出处(守门 4「migration 缺失列」)
 *   schema_check(apps/ai-service/app/core/schema_check.py)只比对列名与类型,
 *   nullability/default 不参与判红;此处仍如实写,供 $inferSelect 消费方取到正确可选性。
 *
 * 索引说明:下列索引声明与 pg_indexes 现状逐一对应(含 DESC 与 expires_at 部分索引)。
 *   这些表由 Python 侧 raw SQL 管理,drizzle-kit 不对此库生成/应用迁移,
 *   索引声明是文档性质的对照基准,不参与任何生成动作。
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigserial,
  boolean,
  doublePrecision,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
// bytea:drizzle-orm 0.45 的 pg-core 未原生导出,复用 users.ts 的 customType 适配
// (schema_check 的 _COLUMN_RE 认 `bytea('col')` 形态,与导入来源无关)
import { bytea } from './users.js'

// ============================================================================
// L2-3 记忆衰减状态持久化(agent_memory_decay_state)
//   PK: entry_id(text);库里 user_id 为 uuid(代码发 UUID 对象,_parse_uuid 失败写 NULL)
// ============================================================================
export const agentMemoryDecayState = pgTable(
  'agent_memory_decay_state',
  {
    entryId: text('entry_id').primaryKey().notNull(),
    userId: uuid('user_id'),
    accessCount: integer('access_count').default(0),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    retentionScore: doublePrecision('retention_score').default(1.0),
    isDecayed: boolean('is_decayed').default(false),
    config: jsonb('config'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('agent_memory_decay_state_user_idx').on(t.userId),
    decayedIdx: index('agent_memory_decay_state_decayed_idx').on(t.isDecayed),
  }),
)

// ============================================================================
// L4 元学习元知识持久化(agent_meta_lessons)
//   PK: id(bigint 序列);source_skills 为 jsonb(非 text[])
// ============================================================================
export const agentMetaLessons = pgTable(
  'agent_meta_lessons',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),
    userId: text('user_id'),
    lessonType: varchar('lesson_type', { length: 64 }),
    title: text('title'),
    content: text('content'),
    anonymizedContent: text('anonymized_content'),
    confidence: doublePrecision('confidence').default(0),
    occurrenceCount: integer('occurrence_count').default(0),
    sourceUserIdsHash: text('source_user_ids_hash'),
    dpNoiseAdded: boolean('dp_noise_added').default(false),
    sourceSkills: jsonb('source_skills').default([]),
    systemPromptSnippet: text('system_prompt_snippet'),
    failurePatternId: varchar('failure_pattern_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),

    /**
     * 过期时间(2026-10-03 数据出域合规整改加列)。
     *
     * 本表此前**没有任何清理路径** —— 不是"有机制但没开",是机制根本不存在,
     * 而它存的是用户内容。对标智谱 ZCode 事件里的"未经知情长期留存"。
     *
     * 档位 180 天:元经验教训:与 relay_messages 同档(对话提炼物,信息已压缩)
     * NULL = 永不过期,仅限显式选择长期保留;清理任务按本列分批回收。
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    typeIdx: index('agent_meta_lessons_type_idx').on(t.lessonType),
    confidenceIdx: index('agent_meta_lessons_confidence_idx').on(t.confidence.desc()),
    occurrenceIdx: index('agent_meta_lessons_occurrence_idx').on(t.occurrenceCount.desc()),
    updatedIdx: index('agent_meta_lessons_updated_idx').on(t.updatedAt.desc()),
    userTypeIdx: index('agent_meta_lessons_user_type_idx').on(t.userId, t.lessonType),
    typeTitleIdx: index('idx_agent_meta_lessons_type_title').on(t.lessonType, t.title),
    expiresIdx: index('ix_agent_meta_lessons_expires_at')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
  }),
)

// ============================================================================
// L5 A/B 测试主表(agent_ab_tests)
//   PK: id(uuid,代码显式传 UUID 对象);status varchar(32)
// ============================================================================
export const agentAbTests = pgTable(
  'agent_ab_tests',
  {
    id: uuid('id').primaryKey().notNull(),
    skillName: text('skill_name'),
    controlVersion: text('control_version'),
    treatmentVersion: text('treatment_version'),
    status: varchar('status', { length: 32 }).default('running'),
    shadowRatio: doublePrecision('shadow_ratio').default(0.1),
    minSampleSize: integer('min_sample_size').default(100),
    significanceLevel: doublePrecision('significance_level').default(0.05),
    controlStats: jsonb('control_stats').default({}),
    treatmentStats: jsonb('treatment_stats').default({}),
    decision: text('decision'),
    decisionReason: text('decision_reason'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => ({
    skillStatusIdx: index('agent_ab_tests_skill_status_idx').on(t.skillName, t.status),
    statusIdx: index('agent_ab_tests_status_idx').on(t.status),
    startedAtIdx: index('agent_ab_tests_started_at_idx').on(t.startedAt.desc()),
  }),
)

// ============================================================================
// L6 多模态记忆持久化(agent_multimodal_memory)
//   PK: id(uuid gen_random_uuid());content_hash 有唯一索引(去重依据)
// ============================================================================
export const agentMultimodalMemory = pgTable(
  'agent_multimodal_memory',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: text('user_id'),
    modality: varchar('modality', { length: 32 }),
    sourceUri: text('source_uri'),
    caption: text('caption'),
    contentHash: text('content_hash'),
    contentBytes: bytea('content_bytes'),
    embedding: jsonb('embedding'),
    importanceScore: doublePrecision('importance_score').default(0),
    accessCount: integer('access_count').default(0),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),

    /**
     * 过期时间(2026-10-03 数据出域合规整改加列)。
     *
     * 本表此前**没有任何清理路径** —— 不是"有机制但没开",是机制根本不存在,
     * 而它存的是用户内容。对标智谱 ZCode 事件里的"未经知情长期留存"。
     *
     * 档位 90 天:多模态记忆:本组最短档 —— caption/source_uri 可能带本地文件路径,最敏感
     * NULL = 永不过期,仅限显式选择长期保留;清理任务按本列分批回收。
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('agent_multimodal_memory_user_idx').on(t.userId),
    userModalityIdx: index('agent_multimodal_memory_user_modality_idx').on(t.userId, t.modality),
    contentHashIdx: index('agent_multimodal_memory_content_hash_idx').on(t.contentHash),
    contentHashUniq: uniqueIndex('agent_multimodal_memory_hash_uniq').on(t.contentHash),
    userCreatedIdx: index('agent_multimodal_memory_user_created_idx').on(
      t.userId,
      t.createdAt.desc(),
    ),
    expiresIdx: index('ix_agent_multimodal_memory_expires_at')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
  }),
)

// ============================================================================
// L7 联邦学习元知识持久化(agent_federated_lessons)
//   PK: id(bigint 序列,代码不传 id 由 DB 生成);dp_noise_added 为 boolean(非 real)
// ============================================================================
export const agentFederatedLessons = pgTable(
  'agent_federated_lessons',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),
    lessonType: varchar('lesson_type', { length: 64 }),
    title: text('title'),
    content: text('content'),
    confidence: doublePrecision('confidence').default(0),
    occurrenceCount: integer('occurrence_count').default(0),
    sourceUserCount: integer('source_user_count').default(0),
    sourceUserIdsHash: text('source_user_ids_hash'),
    anonymized: boolean('anonymized').default(true),
    dpNoiseAdded: boolean('dp_noise_added').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),

    /**
     * 过期时间(2026-10-03 数据出域合规整改加列)。
     *
     * 本表此前**没有任何清理路径** —— 不是"有机制但没开",是机制根本不存在,
     * 而它存的是用户内容。对标智谱 ZCode 事件里的"未经知情长期留存"。
     *
     * 档位 365 天:跨用户聚合经验(已匿名化+DP 噪声),生命周期比个人记忆长
     * NULL = 永不过期,仅限显式选择长期保留;清理任务按本列分批回收。
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    typeIdx: index('agent_federated_lessons_type_idx').on(t.lessonType),
    confidenceIdx: index('agent_federated_lessons_confidence_idx').on(t.confidence.desc()),
    typeTitleIdx: index('agent_federated_lessons_type_title_idx').on(t.lessonType, t.title),
    expiresIdx: index('ix_agent_federated_lessons_expires_at')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
  }),
)

// ============================================================================
// L8 长程一致性:会话摘要 + 工作记忆压缩日志
//   session_summary.id 库里无 default(代码显式传 uuid4());key_facts/key_decisions 为 jsonb
// ============================================================================
export const agentSessionSummary = pgTable(
  'agent_session_summary',
  {
    id: uuid('id').primaryKey().notNull(),
    userId: text('user_id'),
    sessionId: text('session_id'),
    summary: text('summary'),
    keyFacts: jsonb('key_facts').default([]),
    keyDecisions: jsonb('key_decisions').default([]),
    embedding: jsonb('embedding'),
    importanceScore: doublePrecision('importance_score').default(0),
    messageCount: integer('message_count').default(0),
    tokenCount: integer('token_count').default(0),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),

    /**
     * 过期时间(2026-10-03 数据出域合规整改加列)。
     *
     * 本表此前**没有任何清理路径** —— 不是"有机制但没开",是机制根本不存在,
     * 而它存的是用户内容。对标智谱 ZCode 事件里的"未经知情长期留存"。
     *
     * 档位 180 天:会话摘要:与 relay_messages 同档,单独留一份没有意义
     * NULL = 永不过期,仅限显式选择长期保留;清理任务按本列分批回收。
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('agent_session_summary_user_idx').on(t.userId),
    userEndIdx: index('agent_session_summary_user_end_idx').on(t.userId, t.endTime.desc()),
    sessionIdx: index('agent_session_summary_session_idx').on(t.sessionId),
    expiresIdx: index('ix_agent_session_summary_expires_at')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
  }),
)

/**
 * 工作记忆压缩审计日志。
 * id 为 uuid(代码发 uuid4());original_messages/compressed_to 为 integer NOT NULL
 * (2026-10-18 收敛:库里原为 jsonb/text,与代码发的 int 不兼容,已 DROP+ADD 重建)。
 */
export const agentWorkingMemoryCompression = pgTable(
  'agent_working_memory_compression',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: text('user_id'),
    sessionId: text('session_id'),
    originalMessages: integer('original_messages').notNull(),
    compressedTo: integer('compressed_to').notNull(),
    compressionRatio: doublePrecision('compression_ratio').default(0),
    strategy: varchar('strategy', { length: 32 }).default('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('agent_working_memory_compression_user_idx').on(t.userId),
    userSessionIdx: index('agent_working_memory_compression_user_session_idx').on(
      t.userId,
      t.sessionId,
    ),
  }),
)

// ============================================================================
// L9 元认知反思日志(agent_metacognition_log)
//   PK: id(bigint 序列);findings/actions_taken 为 jsonb(读路径须 coerce,
//   共享池不注册 jsonb codec ⇒ asyncpg 返回 str,见 metacognition._coerce_jsonb_list)
// ============================================================================
export const agentMetacognitionLog = pgTable(
  'agent_metacognition_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey().notNull(),
    userId: text('user_id'),
    targetLayer: varchar('target_layer', { length: 64 }),
    targetId: text('target_id'),
    reflectionType: varchar('reflection_type', { length: 64 }),
    findings: jsonb('findings'),
    actionsTaken: jsonb('actions_taken').default([]),
    confidence: doublePrecision('confidence').default(0),
    llmUsed: boolean('llm_used'),
    tokenCost: integer('token_cost').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('agent_metacognition_log_user_idx').on(t.userId),
    typeIdx: index('agent_metacognition_log_type_idx').on(t.reflectionType),
    createdIdx: index('agent_metacognition_log_created_idx').on(t.createdAt.desc()),
  }),
)

// ============================================================================
// L2-4 用户画像聚合持久化(agent_user_profile)
//   PK: user_id(uuid,代码发 UUID 对象);profile jsonb
// ============================================================================
export const agentUserProfile = pgTable(
  'agent_user_profile',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    profile: jsonb('profile').default({}),
    completeness: doublePrecision('completeness').default(0),
    totalMemories: integer('total_memories').default(0),
    systemPromptSnippet: text('system_prompt_snippet'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /**
     * 过期时间(2026-10-03 数据出域合规整改加列)。
     *
     * 本表此前**没有任何清理路径** —— 不是"有机制但没开",是机制根本不存在,
     * 而它存的是用户内容。对标智谱 ZCode 事件里的"未经知情长期留存"。
     *
     * 档位 180 天:用户画像:本表 created_at/updated_at 并存(2026-10-18 补 created_at),
     * 按 updated_at 判过期(它是"最近一次提炼结果"非流水)
     * NULL = 永不过期,仅限显式选择长期保留;清理任务按本列分批回收。
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    completenessIdx: index('agent_user_profile_completeness_idx').on(t.completeness.desc()),
    updatedIdx: index('agent_user_profile_updated_idx').on(t.updatedAt.desc()),
    expiresIdx: index('ix_agent_user_profile_expires_at')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
  }),
)

export type AgentMemoryDecayState = typeof agentMemoryDecayState.$inferSelect
export type NewAgentMemoryDecayState = typeof agentMemoryDecayState.$inferInsert
export type AgentMetaLesson = typeof agentMetaLessons.$inferSelect
export type NewAgentMetaLesson = typeof agentMetaLessons.$inferInsert
export type AgentAbTest = typeof agentAbTests.$inferSelect
export type NewAgentAbTest = typeof agentAbTests.$inferInsert
export type AgentMultimodalMemory = typeof agentMultimodalMemory.$inferSelect
export type NewAgentMultimodalMemory = typeof agentMultimodalMemory.$inferInsert
export type AgentFederatedLesson = typeof agentFederatedLessons.$inferSelect
export type NewAgentFederatedLesson = typeof agentFederatedLessons.$inferInsert
export type AgentSessionSummary = typeof agentSessionSummary.$inferSelect
export type NewAgentSessionSummary = typeof agentSessionSummary.$inferInsert
export type AgentWorkingMemoryCompression = typeof agentWorkingMemoryCompression.$inferSelect
export type NewAgentWorkingMemoryCompression = typeof agentWorkingMemoryCompression.$inferInsert
export type AgentMetacognitionLog = typeof agentMetacognitionLog.$inferSelect
export type NewAgentMetacognitionLog = typeof agentMetacognitionLog.$inferInsert
export type AgentUserProfile = typeof agentUserProfile.$inferSelect
export type NewAgentUserProfile = typeof agentUserProfile.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
