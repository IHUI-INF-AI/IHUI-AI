// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  bigserial,
  check,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { agentDefinitions } from './agent-definitions.js'
import { users } from './users.js'

/**
 * 定义版本快照(总管智能体 P1-02,2026-11-27 立)。
 *
 * 不变量 I4/I5:版本号单调递增不跳号;每次写定义都落一份**完整**快照 ——
 * 快照必须覆盖全部可变字段(name/display_name/description/role/system_prompt/
 * prompt_version/model/temperature/max_tokens/tools/skills/permissions/memory_policy/
 * budget/concurrency_limit/is_dispatchable/status/metadata),否则回滚不完整。
 * 写入前由服务层用键集合校验快照,这里不替调用方"补默认值"。
 *
 * 生命周期:随定义永久保留;purge 定义时先归档到对象存储/JSONL 再删(CASCADE)。
 * change_kind 封闭集与定义状态机的动作一一对应,新增动作必须同步改本约束。
 */
export const agentDefinitionVersions = pgTable(
  'agent_definition_versions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    /** create | update | clone | rollback | delete | restore | purge */
    changeKind: varchar('change_kind', { length: 16 }).$type<AgentDefinitionChangeKind>().notNull(),
    /** 完整定义快照(键集合由服务层校验;此处只保证可存 JSON) */
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    changeSummary: varchar('change_summary', { length: 300 }).default('').notNull(),
    /** 行为主体;用户注销后保留证据,故 SET NULL 而不是 CASCADE */
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /** 同一定义的版本号唯一:并发写版本由唯一约束兜底(冲突 → AGENT_VERSION_CONFLICT) */
    definitionVersionUq: unique('agent_definition_versions_definition_version_uq').on(
      t.definitionId,
      t.version,
    ),
    versionCheck: check('ck_agent_def_version_positive', sql`${t.version} > 0`),
    kindCheck: check(
      'ck_agent_def_version_kind',
      sql`${t.changeKind} in ('create', 'update', 'clone', 'rollback', 'delete', 'restore', 'purge')`,
    ),
  }),
)

export type AgentDefinitionChangeKind =
  'create' | 'update' | 'clone' | 'rollback' | 'delete' | 'restore' | 'purge'

export type AgentDefinitionVersion = typeof agentDefinitionVersions.$inferSelect
export type NewAgentDefinitionVersion = typeof agentDefinitionVersions.$inferInsert
