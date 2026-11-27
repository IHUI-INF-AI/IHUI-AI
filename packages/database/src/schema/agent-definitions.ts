// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { agents } from './agents-extended.js'
import { teams } from './teams.js'
import { users } from './users.js'

/**
 * 统一智能体注册表 · 定义主表(总管智能体 P1-01,2026-11-27 立)。
 *
 * 一张表同时承载三种作用域(system / personal / team),靠 CHECK 约束而不是三张表:
 * - system:平台内置,owner_user_id 与 team_id 都为空;只有这一档允许 is_builtin=true。
 * - personal:个人定义,必须有 owner_user_id,不能挂团队。
 * - team:团队定义,owner_user_id(创建者/计费主体)与 team_id 都必填。
 *
 * team_id 指向 `teams`(面向人的工作区团队),**不是** `agent_teams`(智能体协作小组):
 * 两者语义不同,混用会把"同事共享"与"智能体小组"绑死。ON DELETE RESTRICT 强制团队解散
 * 前先停用/迁移定义 —— 若用 SET NULL,会把 scope='team' 的行打成违反 ck_agent_def_scope 的孤儿。
 *
 * 名称唯一性是三条部分唯一索引,按作用域分别收口,均排除软删行(status='deleted'):
 * - 软删不释放名称,恢复时若同名新定义已存在 → 唯一索引冲突,服务层按 AGENT_NAME_TAKEN 返回;
 * - system 档的索引不带 status 谓词(只按 scope='system' 过滤):系统定义的名称是保留名,
 *   即便某条非 builtin 的 system 定义被软删,也不允许另一个定义复用同名,避免"同名换主"。
 *
 * market_agent_id 是市场商品(agents.agent_id)的链接;商品下架只解链(SET NULL),不删定义。
 */
export const agentDefinitions = pgTable(
  'agent_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** NULL = system 档;personal/team 必填,见 ck_agent_def_scope */
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** 人类工作区团队;ON DELETE RESTRICT,团队解散前必须先处置定义 */
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'restrict' }),
    /** system | personal | team */
    scope: varchar('scope', { length: 16 }).$type<AgentDefinitionScope>().notNull(),
    /** 机器名:小写字母/数字开头,只允许 [a-z0-9_-],总长 1–32;用于工具寻址与唯一性 */
    name: varchar('name', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    description: text('description').default('').notNull(),
    /** 角色键(researcher/coder/.../custom);与 shared 契约的角色枚举同源 */
    role: varchar('role', { length: 32 }).default('custom').notNull(),
    systemPrompt: text('system_prompt').default('').notNull(),
    /** 提示词版本单调递增;写新提示词必须同时写 agent_definition_versions 快照 */
    promptVersion: integer('prompt_version').default(1).notNull(),
    model: varchar('model', { length: 100 }),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.70').notNull(),
    maxTokens: integer('max_tokens'),
    tools: jsonb('tools').$type<string[]>().default([]).notNull(),
    skills: jsonb('skills').$type<string[]>().default([]).notNull(),
    permissions: jsonb('permissions').$type<Record<string, unknown>>().default({}).notNull(),
    memoryPolicy: jsonb('memory_policy').$type<Record<string, unknown>>().default({}).notNull(),
    budget: jsonb('budget').$type<Record<string, unknown>>().default({}).notNull(),
    concurrencyLimit: integer('concurrency_limit').default(2).notNull(),
    /** active | disabled | deleted;只有 active 可派发 */
    status: varchar('status', { length: 16 })
      .$type<AgentDefinitionStatus>()
      .default('active')
      .notNull(),
    /** 内置定义:必须 system 档;builtin 不可删除(builtin → deleted 被服务层状态机拒绝) */
    isBuiltin: boolean('is_builtin').default(false).notNull(),
    /** master 唯一为 false;内置 worker 默认 true */
    isDispatchable: boolean('is_dispatchable').default(true).notNull(),
    /** 市场商品链接;下架只解链 */
    marketAgentId: uuid('market_agent_id').references(() => agents.agentId, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    /** 乐观并发版本(CAS 判据);软删不归零 */
    version: integer('version').default(1).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    /** 软删时间;与 purge_after 必须成对出现,见 ck_agent_def_deleted */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    /** 可彻底删除的最早时间(软删 + 30 天);purge 前必须二次审批 */
    purgeAfter: timestamp('purge_after', { withTimezone: true }),
  },
  (t) => ({
    /** 个人定义名称:同一 owner 内唯一,排除软删 */
    personalNameUq: uniqueIndex('uq_agent_def_personal_name')
      .on(t.ownerUserId, t.name)
      .where(sql`${t.scope} = 'personal' AND ${t.status} <> 'deleted'`),
    /** 团队定义名称:同一 team 内唯一,排除软删 */
    teamNameUq: uniqueIndex('uq_agent_def_team_name')
      .on(t.teamId, t.name)
      .where(sql`${t.scope} = 'team' AND ${t.status} <> 'deleted'`),
    /** 系统定义名称:全局唯一;系统名是保留名,只有软删系统的唯一例外由服务层状态机挡 */
    systemNameUq: uniqueIndex('uq_agent_def_system_name')
      .on(t.name)
      .where(sql`${t.scope} = 'system'`),
    ownerStatusIdx: index('ix_agent_def_owner_status').on(
      t.ownerUserId,
      t.status,
      t.updatedAt.desc(),
    ),
    teamStatusIdx: index('ix_agent_def_team_status').on(t.teamId, t.status, t.updatedAt.desc()),
    scopeStatusIdx: index('ix_agent_def_scope_status').on(t.scope, t.status),
    marketIdx: index('ix_agent_def_market')
      .on(t.marketAgentId)
      .where(sql`${t.marketAgentId} IS NOT NULL`),
    /** 作用域三选一:system 无主无团队;personal 有主无团队;team 有主有团队 */
    scopeCheck: check(
      'ck_agent_def_scope',
      sql`(${t.scope} = 'system' AND ${t.ownerUserId} IS NULL AND ${t.teamId} IS NULL)
        OR (${t.scope} = 'personal' AND ${t.ownerUserId} IS NOT NULL AND ${t.teamId} IS NULL)
        OR (${t.scope} = 'team' AND ${t.ownerUserId} IS NOT NULL AND ${t.teamId} IS NOT NULL)`,
    ),
    scopeValueCheck: check(
      'ck_agent_def_scope_value',
      sql`${t.scope} in ('system', 'personal', 'team')`,
    ),
    /** 机器名口径:首字符小写字母/数字,其余仅 [a-z0-9_-],总长 ≤32 */
    nameCheck: check('ck_agent_def_name', sql`${t.name} ~ '^[a-z0-9][a-z0-9_-]{0,31}$'`),
    builtinCheck: check('ck_agent_def_builtin', sql`NOT ${t.isBuiltin} OR ${t.scope} = 'system'`),
    /** 软删三件套必须同时成立:deleted 必有 deleted_at/purge_after,非 deleted 必无 */
    deletedCheck: check(
      'ck_agent_def_deleted',
      sql`(${t.status} = 'deleted' AND ${t.deletedAt} IS NOT NULL AND ${t.purgeAfter} IS NOT NULL)
        OR (${t.status} <> 'deleted' AND ${t.deletedAt} IS NULL AND ${t.purgeAfter} IS NULL)`,
    ),
    statusValueCheck: check(
      'ck_agent_def_status_value',
      sql`${t.status} in ('active', 'disabled', 'deleted')`,
    ),
    temperatureCheck: check('ck_agent_def_temperature', sql`${t.temperature} between 0 and 2`),
    maxTokensCheck: check('ck_agent_def_max_tokens', sql`${t.maxTokens} between 1 and 200000`),
    concurrencyCheck: check('ck_agent_def_concurrency', sql`${t.concurrencyLimit} between 1 and 8`),
    versionCheck: check('ck_agent_def_version', sql`${t.version} > 0`),
    promptVersionCheck: check('ck_agent_def_prompt_version', sql`${t.promptVersion} > 0`),
  }),
)

export type AgentDefinitionScope = 'system' | 'personal' | 'team'
export type AgentDefinitionStatus = 'active' | 'disabled' | 'deleted'

export type AgentDefinition = typeof agentDefinitions.$inferSelect
export type NewAgentDefinition = typeof agentDefinitions.$inferInsert
