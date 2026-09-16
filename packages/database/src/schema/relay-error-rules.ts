import { pgTable, uuid, varchar, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 上游错误透传规则表(relay_error_passthrough_rules,2026-09-16 立,五轮补强,
 * 对标竞品 /error-passthrough-rules)。
 *
 * 用途:定义上游返回的错误如何呈现给下游 API 消费者——
 * 上游 429(限流)、上游 402(额度耗尽)、上游内容审核拒绝等,是原样透传、
 * 改写文案,还是归一成通用错误。避免"上游一句英文报错直接甩给客户"或
 * "所有错误都变成 500 掩盖真实原因"两个极端。
 *
 * 匹配:upstreamStatus 精确匹配(必填)+ keyword 为空或命中上游消息子串;
 * priority 大者优先,取第一条启用的命中规则。
 */
export const relayErrorPassthroughRules = pgTable(
  'relay_error_passthrough_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 上游 HTTP 状态码(如 429/402/400/500) */
    upstreamStatus: integer('upstream_status').notNull(),
    /** 上游错误消息关键字(空 = 不限制,仅按状态码匹配) */
    keyword: varchar('keyword', { length: 128 }),
    /** 呈现给下游的状态码 */
    downstreamStatus: integer('downstream_status').notNull(),
    /** 呈现给下游的消息模板,可含 {upstream} 占位符(替换为上游原始消息) */
    messageTemplate: varchar('message_template', { length: 500 }).notNull(),
    /** 是否附带上游原始消息(追加在模板渲染后的括号内) */
    exposeUpstreamMessage: boolean('expose_upstream_message').default(false).notNull(),
    priority: integer('priority').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    remark: varchar('remark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    enabledIdx: index('relay_error_passthrough_rules_enabled_idx').on(t.enabled),
    statusIdx: index('relay_error_passthrough_rules_status_idx').on(t.upstreamStatus),
  }),
)

export type RelayErrorPassthroughRule = typeof relayErrorPassthroughRules.$inferSelect
export type NewRelayErrorPassthroughRule = typeof relayErrorPassthroughRules.$inferInsert
