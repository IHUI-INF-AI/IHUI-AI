import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * OAuth 私钥表（多租户 JWT/RS256 签名密钥管理）。
 * 迁移自 D 盘 coze_zhs_py/models/oauth_models.py:63-74 OAuthPrivateKey。
 * - clientId: 关联 oauth_apps.client_id
 * - privateKey: PEM 格式私钥(明文,向后兼容;新增应同时填 encryptionKeyId 走 KMS)
 * - publicKey: PEM 格式公钥（用于本地验签/分发 JWKS）
 * - keyType: RSA | EC | HMAC
 * - isActive: 1=active 0=disabled（轮转时旧密钥不删，置 0 保留 30 天）
 *
 * 2026-07-22 鲁棒性加固:
 * - 新增 encryptionKeyId 列:KMS key ID 占位,用于字段级加密
 * - encryptionKeyId 非空时:privateKey 字段存储 KMS 加密后的密文,
 *   读取时需调用 KMS 解密(encryptionKeyId 指定 KMS key)
 * - encryptionKeyId 为空时:privateKey 仍为明文(向后兼容,生产环境应迁移)
 * - 破坏性:生产环境需逐步迁移,把 privateKey 改为 KMS 加密 + 填 encryptionKeyId
 */
export const oauthPrivateKeys = pgTable(
  'oauth_private_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: varchar('client_id', { length: 100 }).notNull(),
    privateKey: text('private_key').notNull(),
    /**
     * KMS key ID(可选)。非空时 privateKey 字段为 KMS 加密密文。
     * 由 apps/api 层的 KMS 客户端解密后使用(本包不依赖 KMS SDK)。
     */
    encryptionKeyId: varchar('encryption_key_id', { length: 256 }),
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
