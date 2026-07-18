import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * OAuth 私钥表（多租户 JWT/RS256 签名密钥管理）。
 * 迁移自 D 盘 coze_zhs_py/models/oauth_models.py:63-74 OAuthPrivateKey。
 * - clientId: 关联 oauth_apps.client_id
 * - privateKey: PEM 格式私钥（建议生产环境用 KMS 加密存储）
 * - publicKey: PEM 格式公钥（用于本地验签/分发 JWKS）
 * - keyType: RSA | EC | HMAC
 * - isActive: 1=active 0=disabled（轮转时旧密钥不删，置 0 保留 30 天）
 */
export const oauthPrivateKeys = pgTable(
  'oauth_private_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: varchar('client_id', { length: 100 }).notNull(),
    privateKey: text('private_key').notNull(),
    publicKey: text('public_key'),
    keyType: varchar('key_type', { length: 50 }).default('RSA').notNull(),
    isActive: integer('is_active').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clientIdx: index('oauth_private_keys_client_idx').on(t.clientId),
    activeIdx: index('oauth_private_keys_active_idx').on(t.isActive),
  }),
);

export type OauthPrivateKey = typeof oauthPrivateKeys.$inferSelect;
export type NewOauthPrivateKey = typeof oauthPrivateKeys.$inferInsert;
