// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 事件唤醒型云 Agent —— 触发规则表(2026-09-08 立)。
 *
 * 复检报告缺口 #5:cloud_runs / automations 仅支持手动与定时触发,缺事件订阅自动开工。
 * 本表对标 Cursor Cloud Agents 事件唤醒 / GitHub HydraFusion+Agent Merge:
 *   用户在 GitHub 配置 webhook 指向 POST /api/webhooks/github,
 *   收到 pull_request/opened、issues/opened、push 等事件后,
 *   按 (repoFullName, event) 匹配本表规则,命中则自动创建一次 agent 运行。
 *
 * 设计要点(事件唤醒 = automations 调度器的"事件源从时钟换成 webhook"):
 * - event:GitHub 事件名(pull_request / issues / push)
 * - action:jsonb,存放创建 agent 运行的参数 —— 至少含 prompt,可选 mode / agentId
 *   (与 automations 的 prompt 字段同源,复用 agent-runtime 执行器)
 * - enabled:规则开关(禁用时 webhook 收到事件直接跳过)
 * - lastFiredAt / lastResult:最近一次命中执行的记录(执行失败不重试,详见服务层注释)
 */
import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/** action jsonb 结构:创建 agent 运行所需的参数(从 webhook 事件上下文构造) */
export interface EventTriggerAction {
  /** 注入 agent 的提示词(可使用 {{sender}} / {{repo}} 等占位符,服务层渲染) */
  prompt: string
  /** agent-runtime 执行模式,默认 'auto' */
  mode?: string
  /** 指定 agent 标识(可选,缺省用触发规则 id 作为 botId) */
  agentId?: string
}

/** lastResult jsonb 结构:最近一次命中执行的摘要(执行失败不重试) */
export interface EventTriggerLastResult {
  finishedAt: string
  summary: string
}

export const agentEventTriggers = pgTable(
  'agent_event_triggers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    /** GitHub 仓库全名(owner/repo),用于匹配 webhook payload 的 repository.full_name */
    repoFullName: varchar('repo_full_name', { length: 255 }).notNull(),
    /** GitHub 事件名:pull_request | issues | push */
    event: varchar('event', { length: 40 }).notNull(),
    /** 创建 agent 运行的参数(prompt / mode / agentId),jsonb */
    action: jsonb('action').$type<EventTriggerAction>().notNull(),
    /** 规则开关:disabled 时 webhook 收到事件直接跳过 */
    enabled: varchar('enabled', { length: 8 }).default('true').notNull(),
    lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
    lastResult: jsonb('last_result').$type<EventTriggerLastResult>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('agent_event_triggers_user_idx').on(t.userId),
    repoEventIdx: index('agent_event_triggers_repo_event_idx').on(t.repoFullName, t.event),
  }),
)

export type AgentEventTrigger = typeof agentEventTriggers.$inferSelect
export type NewAgentEventTrigger = typeof agentEventTriggers.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
