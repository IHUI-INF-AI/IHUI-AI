import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 中转站渠道分组表(2026-07-31 立,#4 #6 合并任务)。
 *
 * 一个渠道组聚合多个 ai_relay_key_pool 条目,提供:
 * - 负载均衡策略:weight(加权随机)/ round-robin(轮询)/ least-latency(最少延迟)
 * - 优先级:高的先用,故障降级到低的
 * - 配合 relay-channel-router 实现按模型路由 + 故障自动切换(熔断 + 半开探测)
 *
 * 关联:ai_relay_channel_group_members.key_pool_id → ai_relay_key_pool.id(不加 FK 约束,
 * 因 ai_relay_key_pool 定义在 ai-relay.ts,跨文件 FK 在 drizzle 中需显式引用,此处保持松耦合)
 */
export const aiRelayChannelGroups = pgTable(
  'ai_relay_channel_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 组名(admin 识别用,如 'openai-group' / 'claude-group') */
    name: varchar('name', { length: 64 }).notNull(),
    /** 描述 */
    description: text('description'),
    /**
     * 负载均衡策略:
     * - weight: 加权随机(权重越大选中概率越高)
     * - round-robin: 轮询
     * - least-latency: 最少延迟(从最近 10 次调用的平均延迟选最小的)
     */
    loadBalanceStrategy: varchar('load_balance_strategy', { length: 32 })
      .default('weight')
      .notNull(),
    /** 是否启用 */
    enabled: boolean('enabled').default(true).notNull(),
    /** 组优先级(数字越大越优先,故障降级到低的) */
    priority: integer('priority').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    enabledIdx: index('ai_relay_channel_groups_enabled_idx').on(t.enabled),
    priorityIdx: index('ai_relay_channel_groups_priority_idx').on(t.priority),
    nameUniq: unique('ai_relay_channel_groups_name_unique').on(t.name),
  }),
)

/**
 * 渠道-分组关联表(一个 key_pool 条目可属于多个组)。
 *
 * 注意:key_pool_id 不加 FK 约束,因 ai_relay_key_pool 定义在 ai-relay.ts,
 * 此处保持松耦合以便独立迁移。删除 key_pool 条目前应由应用层清理成员关系。
 */
export const aiRelayChannelGroupMembers = pgTable(
  'ai_relay_channel_group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 所属组 id */
    groupId: uuid('group_id')
      .references(() => aiRelayChannelGroups.id, { onDelete: 'cascade' })
      .notNull(),
    /** 关联 ai_relay_key_pool.id(不加 FK 约束,跨 schema 文件松耦合) */
    keyPoolId: uuid('key_pool_id').notNull(),
    /** 组内权重(用于 weight 策略,默认 1) */
    weight: integer('weight').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    groupIdIdx: index('ai_relay_channel_group_members_group_id_idx').on(t.groupId),
    keyPoolIdIdx: index('ai_relay_channel_group_members_key_pool_id_idx').on(t.keyPoolId),
    // 一个 key 在同一组内只能出现一次(避免重复权重)
    groupKeyUniq: unique('ai_relay_channel_group_members_group_key_unique').on(
      t.groupId,
      t.keyPoolId,
    ),
  }),
)

export type AiRelayChannelGroup = typeof aiRelayChannelGroups.$inferSelect
export type NewAiRelayChannelGroup = typeof aiRelayChannelGroups.$inferInsert
export type AiRelayChannelGroupMember = typeof aiRelayChannelGroupMembers.$inferSelect
export type NewAiRelayChannelGroupMember = typeof aiRelayChannelGroupMembers.$inferInsert
