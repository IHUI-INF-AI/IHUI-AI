/**
 * Agent 持久化状态表(2026-07-25 立,L2-L9 记忆/元学习/多模态/A-B 测试等)。
 *
 * 全部由 apps/ai-service(Python,FastAPI)以 raw SQL 读写,作为各内存管理器
 * (MemoryDecayManager / UserProfileBuilder / MetaLearner / FederatedLearner /
 *  MultimodalMemory / SessionSummarizer / Metacognition / ABTestTracker)的持久化镜像。
 * 此处补 TS schema 定义以消除 check-db-schema-drift 的 dead migration 告警,
 * 并保持 packages/database 单一数据源的表名 ↔ migration 一致性。
 * 字段结构与 drizzle/20260725120000~20260725190000_agent_*.sql 对齐。
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

// ============================================================================
// L2-3 记忆衰减状态持久化(agent_memory_decay_state)
// ============================================================================
export const agentMemoryDecayState = pgTable(
  'agent_memory_decay_state',
  {
    entryId: varchar('entry_id', { length: 100 }).primaryKey().notNull(),
    userId: uuid('user_id'),
    retentionScore: real('retention_score').default(1.0).notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).defaultNow().notNull(),
    accessCount: integer('access_count').default(0).notNull(),
    isDecayed: boolean('is_decayed').default(false).notNull(),
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
// ============================================================================
export const agentMetaLessons = pgTable(
  'agent_meta_lessons',
  {
    id: uuid('id').primaryKey().notNull(),
    lessonType: text('lesson_type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    sourceSkills: text('source_skills').array().notNull().default([]),
    failurePatternId: text('failure_pattern_id'),
    occurrenceCount: integer('occurrence_count').default(1).notNull(),
    confidence: real('confidence').default(0.5).notNull(),
    systemPromptSnippet: text('system_prompt_snippet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index('agent_meta_lessons_type_idx').on(t.lessonType),
    confidenceIdx: index('agent_meta_lessons_confidence_idx').on(t.confidence),
    occurrenceIdx: index('agent_meta_lessons_occurrence_idx').on(t.occurrenceCount),
    updatedIdx: index('agent_meta_lessons_updated_idx').on(t.updatedAt),
  }),
)

// ============================================================================
// L5 A/B 测试主表(agent_ab_tests)
// ============================================================================
export const agentAbTests = pgTable(
  'agent_ab_tests',
  {
    id: uuid('id').primaryKey().notNull(),
    skillName: text('skill_name').notNull(),
    controlVersion: text('control_version').notNull(),
    treatmentVersion: text('treatment_version').notNull(),
    status: text('status').notNull().default('running'),
    shadowRatio: real('shadow_ratio').default(0.1).notNull(),
    minSampleSize: integer('min_sample_size').default(30).notNull(),
    significanceLevel: real('significance_level').default(0.05).notNull(),
    controlStats: jsonb('control_stats').default({}).notNull(),
    treatmentStats: jsonb('treatment_stats').default({}).notNull(),
    decision: text('decision'),
    decisionReason: text('decision_reason'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => ({
    skillStatusIdx: index('agent_ab_tests_skill_status_idx').on(t.skillName, t.status),
    statusIdx: index('agent_ab_tests_status_idx').on(t.status),
    startedAtIdx: index('agent_ab_tests_started_at_idx').on(t.startedAt),
  }),
)

// ============================================================================
// L6 多模态记忆持久化(agent_multimodal_memory)
// ============================================================================
export const agentMultimodalMemory = pgTable(
  'agent_multimodal_memory',
  {
    id: uuid('id').primaryKey().notNull(),
    userId: text('user_id').notNull(),
    modality: text('modality').notNull(),
    sourceUri: text('source_uri'),
    contentHash: text('content_hash').notNull(),
    caption: text('caption'),
    embedding: jsonb('embedding').notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    importanceScore: real('importance_score').default(0.5).notNull(),
    accessCount: integer('access_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  },
  (t) => ({
    userModalityIdx: index('agent_multimodal_memory_user_modality_idx').on(t.userId, t.modality),
    contentHashIdx: index('agent_multimodal_memory_content_hash_idx').on(t.contentHash),
    userCreatedIdx: index('agent_multimodal_memory_user_created_idx').on(t.userId, t.createdAt),
  }),
)

// ============================================================================
// L7 联邦学习元知识持久化(agent_federated_lessons)
// ============================================================================
export const agentFederatedLessons = pgTable(
  'agent_federated_lessons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonType: text('lesson_type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    sourceUserCount: integer('source_user_count').notNull().default(1),
    sourceUserIdsHash: text('source_user_ids_hash'),
    confidence: real('confidence').notNull().default(0.5),
    occurrenceCount: integer('occurrence_count').notNull().default(1),
    dpNoiseAdded: real('dp_noise_added').default(0.0),
    anonymized: boolean('anonymized').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    typeIdx: index('agent_federated_lessons_type_idx').on(t.lessonType),
    confidenceIdx: index('agent_federated_lessons_confidence_idx').on(t.confidence),
    typeTitleIdx: index('agent_federated_lessons_type_title_idx').on(t.lessonType, t.title),
  }),
)

// ============================================================================
// L8 长程一致性:会话摘要 + 工作记忆压缩日志
// ============================================================================
export const agentSessionSummary = pgTable(
  'agent_session_summary',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    sessionId: text('session_id').notNull(),
    summary: text('summary').notNull(),
    keyFacts: jsonb('key_facts').default([]).notNull(),
    keyDecisions: jsonb('key_decisions').default([]).notNull(),
    messageCount: integer('message_count').default(0),
    tokenCount: integer('token_count').default(0),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }).defaultNow(),
    importanceScore: real('importance_score').default(0.5),
    embedding: jsonb('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('agent_session_summary_user_idx').on(t.userId),
    userEndIdx: index('agent_session_summary_user_end_idx').on(t.userId, t.endTime),
    sessionIdx: index('agent_session_summary_session_idx').on(t.sessionId),
  }),
)

export const agentWorkingMemoryCompression = pgTable(
  'agent_working_memory_compression',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    sessionId: text('session_id').notNull(),
    originalMessages: integer('original_messages').notNull(),
    compressedTo: integer('compressed_to').notNull(),
    compressionRatio: real('compression_ratio').notNull(),
    strategy: text('strategy').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userSessionIdx: index('agent_working_memory_compression_user_session_idx').on(
      t.userId,
      t.sessionId,
    ),
  }),
)

// ============================================================================
// L9 元认知反思日志(agent_metacognition_log)
// ============================================================================
export const agentMetacognitionLog = pgTable(
  'agent_metacognition_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id'),
    reflectionType: text('reflection_type').notNull(),
    targetLayer: text('target_layer'),
    targetId: text('target_id'),
    findings: jsonb('findings').default([]).notNull(),
    actionsTaken: jsonb('actions_taken').default([]).notNull(),
    confidence: real('confidence').default(0.5).notNull(),
    llmUsed: boolean('llm_used').default(false).notNull(),
    tokenCost: integer('token_cost').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('agent_metacognition_log_user_idx').on(t.userId),
    typeIdx: index('agent_metacognition_log_type_idx').on(t.reflectionType),
    createdIdx: index('agent_metacognition_log_created_idx').on(t.createdAt),
  }),
)

// ============================================================================
// L2-4 用户画像聚合持久化(agent_user_profile)
// ============================================================================
export const agentUserProfile = pgTable(
  'agent_user_profile',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    completeness: real('completeness').default(0.0).notNull(),
    totalMemories: integer('total_memories').default(0).notNull(),
    profile: jsonb('profile').notNull(),
    systemPromptSnippet: text('system_prompt_snippet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    completenessIdx: index('agent_user_profile_completeness_idx').on(t.completeness),
    updatedIdx: index('agent_user_profile_updated_idx').on(t.updatedAt),
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
