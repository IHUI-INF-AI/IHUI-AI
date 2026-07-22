import { pgTable, uuid, varchar, integer, timestamp, text, boolean, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * OAuth2 应用表（开发者创建的 OAuth 应用）。
 * redirectUris: 多回调白名单数组。scopes: 允许的 scope 数组。
 *
 * 2026-07-22 鲁棒性加固:
 * - 新增 clientSecretHash 列(bcrypt 哈希),逐步替代 clientSecret 明文存储
 * - 迁移期:clientSecret 保留(向后兼容),优先用 clientSecretHash 验证
 * - 迁移完成后:clientSecret 应清空(全部转哈希),仅保留 clientSecretHash
 * - 破坏性:现有 OAuth 应用 clientSecret 需重新生成并写入 clientSecretHash
 */
export const oauthApps = pgTable(
  'oauth_apps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: varchar('client_id', { length: 100 }).notNull(),
    clientSecret: text('client_secret').notNull(),
    /**
     * clientSecret 的 bcrypt 哈希(cost=12)。
     * 写入时:hashClientSecret(plain) → 存储,同时清空 clientSecret 列
     * 验证时:优先用 bcrypt.compare(plain, clientSecretHash),
     *         clientSecretHash 为 null 时回退到 clientSecret 明文(向后兼容)
     */
    clientSecretHash: text('client_secret_hash'),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    redirectUris: jsonb('redirect_uris').notNull().default([]),
    scopes: jsonb('scopes').default([]),
    icon: varchar('icon', { length: 512 }),
    ownerUuid: uuid('owner_uuid').references(() => users.id, { onDelete: 'cascade' }),
    isActive: integer('is_active').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clientIdIdx: unique('oauth_apps_client_id_unique').on(t.clientId),
    ownerIdx: index('oauth_apps_owner_idx').on(t.ownerUuid),
  }),
);

/**
 * OAuth2 授权码会话表。
 * code: 一次性授权码。isUsed: 是否已消费。
 * codeChallenge/codeChallengeMethod: PKCE（仅 S256）。
 */
export const oauthSessions = pgTable(
  'oauth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 100 }).notNull(),
    clientId: varchar('client_id', { length: 100 }).notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    state: varchar('state', { length: 128 }),
    scope: text('scope'),
    codeChallenge: varchar('code_challenge', { length: 256 }),
    codeChallengeMethod: varchar('code_challenge_method', { length: 10 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isUsed: boolean('is_used').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: unique('oauth_sessions_code_unique').on(t.code),
    userIdx: index('oauth_sessions_user_idx').on(t.userId),
  }),
);

/**
 * OAuth 用户映射表（第三方 provider → 本地 user）。
 * provider: google | wechat | workwechat | dingtalk
 */
export const oauthUsers = pgTable(
  'oauth_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerUserId: varchar('provider_user_id', { length: 100 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('oauth_users_user_idx').on(t.userId),
    providerIdx: index('oauth_users_provider_idx').on(t.provider, t.providerUserId),
  }),
);

/**
 * OAuth 审计日志表。
 */
export const oauthAuditLogs = pgTable(
  'oauth_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    event: varchar('event', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 100 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    ip: varchar('ip', { length: 64 }),
    status: varchar('status', { length: 16 }),
    detail: text('detail'),
    requestSummary: jsonb('request_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clientIdx: index('oauth_audit_logs_client_idx').on(t.clientId),
    userIdx: index('oauth_audit_logs_user_idx').on(t.userId),
  }),
);

/**
 * OAuth scope 元数据表。
 */
export const oauthScopeMeta = pgTable(
  'oauth_scope_meta',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scope: varchar('scope', { length: 64 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 512 }),
    category: varchar('category', { length: 64 }),
    isActive: integer('is_active').default(1).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    scopeIdx: unique('oauth_scope_meta_scope_unique').on(t.scope),
  }),
);

/**
 * 用户第三方账号绑定表（小程序 openid / Google sub 等）。
 * platform: wechat | google | workwechat | dingtalk
 * deletedAt: 软删除
 */
export const userThirdPartyAccounts = pgTable(
  'user_third_party_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    openId: varchar('open_id', { length: 100 }),
    unionId: varchar('union_id', { length: 100 }),
    platform: varchar('platform', { length: 20 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_third_party_user_idx').on(t.userId),
    platformIdx: index('user_third_party_platform_idx').on(t.platform, t.openId),
  }),
);

/**
 * 用户 Secret Key 表（API 调用凭据）。
 */
export const userSk = pgTable(
  'user_sk',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    status: integer('status').default(1).notNull(), // 1=active 0=disabled
    type: integer('type').default(0).notNull(),
    max: integer('max').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_sk_user_idx').on(t.userId),
    keyIdx: unique('user_sk_key_unique').on(t.key),
  }),
);

export type OauthApp = typeof oauthApps.$inferSelect;
export type NewOauthApp = typeof oauthApps.$inferInsert;
export type OauthSession = typeof oauthSessions.$inferSelect;
export type NewOauthSession = typeof oauthSessions.$inferInsert;
export type OauthUser = typeof oauthUsers.$inferSelect;
export type NewOauthUser = typeof oauthUsers.$inferInsert;
export type OauthAuditLog = typeof oauthAuditLogs.$inferSelect;
export type UserThirdPartyAccount = typeof userThirdPartyAccounts.$inferSelect;
export type NewUserThirdPartyAccount = typeof userThirdPartyAccounts.$inferInsert;
export type UserSk = typeof userSk.$inferSelect;
export type NewUserSk = typeof userSk.$inferInsert;
export type OauthScopeMeta = typeof oauthScopeMeta.$inferSelect;
