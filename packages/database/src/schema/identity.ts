import { pgTable, bigserial, varchar, integer, timestamp, bigint, index } from 'drizzle-orm/pg-core';

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

// NOTE: oauthPrivateKeys 已迁移到 ./oauth-private-keys.ts (clientId/privateKey/publicKey/isActive 字段)
// 旧定义 (appId/keyData/status 字段) 已删除,避免与 schema/index.ts 的 re-export 冲突。
// 类型 OauthPrivateKey / NewOauthPrivateKey 也从该文件统一导出。

export type ZhsIdentity = typeof zhsIdentity.$inferSelect;
export type NewZhsIdentity = typeof zhsIdentity.$inferInsert;
export type ZhsOrganization = typeof zhsOrganization.$inferSelect;
export type NewZhsOrganization = typeof zhsOrganization.$inferInsert;
