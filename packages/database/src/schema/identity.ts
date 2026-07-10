import { pgTable, bigserial, varchar, integer, text, timestamp, bigint, index } from 'drizzle-orm/pg-core';

/**
 * 身份认证主表（zhs_identity）。
 * - status: 0=禁用, 1=启用。
 * - 旧架构同时有 create_time 与 TimestampMixin 的 created_at/updated_at，完整保留。
 */
export const zhsIdentity = pgTable(
  'zhs_identity',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    identityName: varchar('identity_name', { length: 100 }).notNull(),
    identityType: varchar('identity_type', { length: 50 }),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_zhs_identity_status').on(t.status),
  }),
);

/**
 * 组织机构表（zhs_organization）。
 * - parent_id: 父机构 ID（0=根），bigint 非自增。
 */
export const zhsOrganization = pgTable(
  'zhs_organization',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgName: varchar('org_name', { length: 200 }).notNull(),
    orgType: varchar('org_type', { length: 50 }),
    parentId: bigint('parent_id', { mode: 'number' }).default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdIdx: index('ix_zhs_organization_parent_id').on(t.parentId),
    statusIdx: index('ix_zhs_organization_status').on(t.status),
  }),
);

/**
 * OAuth 私钥表（oauth_private_keys）。
 * - key_type: rsa/ec/hmac。
 * - key_data: 私钥原文（部署时应加密存储）。
 */
export const oauthPrivateKeys = pgTable(
  'oauth_private_keys',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    appId: varchar('app_id', { length: 64 }).notNull(),
    keyType: varchar('key_type', { length: 32 }).default('rsa').notNull(),
    keyData: text('key_data').notNull(),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_oauth_private_keys_status').on(t.status),
  }),
);

export type ZhsIdentity = typeof zhsIdentity.$inferSelect;
export type NewZhsIdentity = typeof zhsIdentity.$inferInsert;
export type ZhsOrganization = typeof zhsOrganization.$inferSelect;
export type NewZhsOrganization = typeof zhsOrganization.$inferInsert;
export type OAuthPrivateKey = typeof oauthPrivateKeys.$inferSelect;
export type NewOAuthPrivateKey = typeof oauthPrivateKeys.$inferInsert;
