import { pgTable, uuid, varchar, integer, timestamp, jsonb, index, text, boolean } from 'drizzle-orm/pg-core'

/**
 * API Key 分组表(2026-08-01 立,P0 中转站造血能力批次)。
 *
 * 多 Key 共享一个额度池:组内任一 Key 消费即扣组池余额(sharedTokenBalance / sharedCostBalanceCents)。
 * 子 Key 继承组级限制(allowedModels / allowedIps / rateLimitQpm),可在 member 行追加更严格限制。
 * 余额规则:-1 = 无限额度,0 = 耗尽,>0 = 可用。
 */
export const apiKeyGroups = pgTable(
  'api_key_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    /** 组创建者(主 Key 持有者) */
    ownerId: uuid('owner_id').notNull(),
    description: text('description'),
    /** 共享 token 余额(-1 = 无限额度,0 = 耗尽,>0 = 可用) */
    sharedTokenBalance: integer('shared_token_balance').default(0).notNull(),
    /** 共享成本余额(分,-1 = 无限额度,0 = 耗尽,>0 = 可用) */
    sharedCostBalanceCents: integer('shared_cost_balance_cents').default(0).notNull(),
    /** 组级 QPM(所有 Key 合计每分钟请求上限) */
    rateLimitQpm: integer('rate_limit_qpm').default(100).notNull(),
    /** 组级模型白名单(子 Key 继承,null/空 = 不限制) */
    allowedModels: jsonb('allowed_models').$type<string[] | null>(),
    /** 组级 IP 白名单(子 Key 继承,null/空 = 不限制),支持 CIDR */
    allowedIps: jsonb('allowed_ips').$type<string[] | null>(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('api_key_groups_owner_idx').on(t.ownerId),
  }),
)

/**
 * API Key 分组成员表(子 Key 加入组,继承组限制 + 可追加更严格限制)。
 * role: 'owner'(创建者) / 'admin'(管理员) / 'member'(普通成员)。
 * 一个 API Key 同时只能在一个组(api_key_id 唯一索引)。
 */
export const apiKeyGroupMembers = pgTable(
  'api_key_group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .references(() => apiKeyGroups.id, { onDelete: 'cascade' })
      .notNull(),
    /** 关联 developer_api_keys.id */
    apiKeyId: uuid('api_key_id').notNull(),
    role: varchar('role', { length: 16 }).default('member').notNull(),
    /** 子 Key 单次请求 token 上限(在组限制基础上收紧,null = 不追加限制) */
    maxTokensPerReq: integer('max_tokens_per_req'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    groupIdx: index('api_key_group_members_group_idx').on(t.groupId),
    apiKeyUniqueIdx: index('api_key_group_members_api_key_unique').on(t.apiKeyId),
  }),
)

/**
 * API Key 分组邀请码表(2026-08-01 立)。
 * 8 位大写字母数字,24h 有效,一次性使用(acceptInvite 后标记 used=true)。
 */
export const apiKeyGroupInvites = pgTable(
  'api_key_group_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .references(() => apiKeyGroups.id, { onDelete: 'cascade' })
      .notNull(),
    /** 8 位大写字母数字邀请码(唯一) */
    inviteCode: varchar('invite_code', { length: 16 }).notNull().unique(),
    /** 创建者(组 owner/admin) */
    createdBy: uuid('created_by').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used: boolean('used').default(false).notNull(),
    /** 使用者 apiKeyId(acceptInvite 后填入) */
    usedBy: uuid('used_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    groupIdx: index('api_key_group_invites_group_idx').on(t.groupId),
    codeIdx: index('api_key_group_invites_code_idx').on(t.inviteCode),
  }),
)

export type ApiKeyGroup = typeof apiKeyGroups.$inferSelect
export type NewApiKeyGroup = typeof apiKeyGroups.$inferInsert
export type ApiKeyGroupMember = typeof apiKeyGroupMembers.$inferSelect
export type NewApiKeyGroupMember = typeof apiKeyGroupMembers.$inferInsert
export type ApiKeyGroupInvite = typeof apiKeyGroupInvites.$inferSelect
export type NewApiKeyGroupInvite = typeof apiKeyGroupInvites.$inferInsert
