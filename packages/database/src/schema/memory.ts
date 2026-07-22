/**
 * 四层记忆系统数据库表(2026-07-22 立,对标 OpenClaw Mem)。
 *
 * 3 张持久化表(working 层在内存,不持久化):
 * - agent_memory_episodic   情景记忆(历史会话片段 + 遗忘曲线衰减)
 * - agent_memory_semantic   语义记忆(pgvector 1536 维向量检索)
 * - agent_memory_procedural 程序记忆(技能/工具用法 success/failure 计数)
 *
 * Dream 梦境机制:consolidate() 把 episodic 提炼为 semantic,forget() 按遗忘曲线衰减。
 *
 * pgvector 类型复用 knowledge-rag.ts 同款 customType 适配(drizzle-orm 0.38 原生 vector 未稳定)。
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * pgvector 1536 维类型(与 knowledge-rag.ts 同款)。
 *
 * - dataType()  → 列定义 vector(1536)
 * - toDriver()  → 写入时把 number[] 序列化为 Postgres array literal '[0.1,0.2,...]'
 * - fromDriver()→ 读取时把 Postgres 字符串 '[0.1,0.2]' 解析回 number[]
 */
export const memoryVector1536 = customType<{
  data: number[] | null
  driverData: string | null
}>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[] | null): string | null {
    if (value === null || value === undefined) return null
    if (!Array.isArray(value)) {
      throw new Error('memoryVector1536.toDriver: value must be number[]')
    }
    if (value.length !== 1536) {
      throw new Error(
        `memoryVector1536.toDriver: dimension mismatch, expected 1536 got ${value.length}`,
      )
    }
    return `[${value.join(',')}]`
  },
  fromDriver(value: string | null): number[] | null {
    if (value === null || value === undefined) return null
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

/**
 * 情景记忆表(历史会话片段)。
 *
 * - importance_score:0-1 重要性评分,影响检索排序与遗忘阈值
 * - decay_factor:遗忘曲线衰减因子(0-1,每次 dream *= 0.95^(days_since_access))
 * - expires_at:过期时间(NULL = 永不过期,由 forget() 按阈值清理)
 * - metadata:jsonb,含 consolidated 标记(dream 固化后置 true)/ 来源 session / 标签等
 */
export const agentMemoryEpisodic = pgTable(
  'agent_memory_episodic',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: varchar('session_id', { length: 64 }).notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    summary: varchar('summary', { length: 500 }),
    importanceScore: numeric('importance_score').default('0.5').notNull(),
    decayFactor: numeric('decay_factor').default('1.0').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdIdx: index('ix_agent_memory_episodic_user').on(t.userId),
    sessionIdx: index('ix_agent_memory_episodic_session').on(t.sessionId),
    importanceIdx: index('ix_agent_memory_episodic_importance').on(t.importanceScore),
  }),
)

/**
 * 语义记忆表(向量检索知识)。
 *
 * - embedding:pgvector 1536 维,用 cosine similarity 检索(SQL `<=>` 距离运算符)
 * - importance_score:0-1 重要性,影响检索 top_k 排序加权
 * - metadata:jsonb 结构化附加字段(来源 session / 标签 / 主题等)
 */
export const agentMemorySemantic = pgTable(
  'agent_memory_semantic',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    /** pgvector 1536 维向量;NULL 时降级为关键词检索 */
    embedding: memoryVector1536('embedding'),
    importanceScore: numeric('importance_score').default('0.5').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdIdx: index('ix_agent_memory_semantic_user').on(t.userId),
    importanceIdx: index('ix_agent_memory_semantic_importance').on(t.importanceScore),
  }),
)

/**
 * 程序记忆表(技能/工具用法模式)。
 *
 * - pattern:工具调用模式(如 "read_file then edit_file" / "search then read")
 * - tool_name:工具名(默认空字符串,与 pattern 组合唯一)
 * - success_count / failure_count:累计成功/失败次数,影响下次是否优先采用
 * - importance_score:0-1 重要性,长期未用 → dream 时降低
 * - last_used_at:最近使用时间
 *
 * 唯一约束 (user_id, pattern, tool_name):upsert 累加 success/failure 计数。
 */
export const agentMemoryProcedural = pgTable(
  'agent_memory_procedural',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    pattern: text('pattern').notNull(),
    toolName: varchar('tool_name', { length: 100 }).default('').notNull(),
    successCount: integer('success_count').default(0).notNull(),
    failureCount: integer('failure_count').default(0).notNull(),
    importanceScore: numeric('importance_score').default('0.5').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('ix_agent_memory_procedural_user').on(t.userId),
    toolIdx: index('ix_agent_memory_procedural_tool').on(t.toolName),
    userPatternToolUnique: uniqueIndex('ux_agent_memory_procedural_user_pattern_tool').on(
      t.userId,
      t.pattern,
      t.toolName,
    ),
  }),
)

export type AgentMemoryEpisodic = typeof agentMemoryEpisodic.$inferSelect
export type NewAgentMemoryEpisodic = typeof agentMemoryEpisodic.$inferInsert
export type AgentMemorySemantic = typeof agentMemorySemantic.$inferSelect
export type NewAgentMemorySemantic = typeof agentMemorySemantic.$inferInsert
export type AgentMemoryProcedural = typeof agentMemoryProcedural.$inferSelect
export type NewAgentMemoryProcedural = typeof agentMemoryProcedural.$inferInsert
