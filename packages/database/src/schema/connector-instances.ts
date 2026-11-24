// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenant.js'
import { users } from './users.js'

/**
 * 连接器实例(2026-11-24 立,迁移自 ai-service 的 JSON 单文件 connector_store.json)。
 *
 * 按租户 + 属主双轴隔离:
 * - tenant_id:记录归属的企业租户(可信承载层传入;个人作用域落平台默认租户兜底)。
 * - owner_user_id:NULL = 租户共享连接器(同租户成员共享);非 NULL = 个人作用域属主。
 *
 * 唯一键选型(PG NULL 不参与普通唯一索引):
 * - 普通唯一索引 (tenant_id, owner_user_id, key):个人作用域行同租户同属主同 key 唯一;
 *   owner_user_id IS NULL 的共享行不参与该索引(NULL 互不相等)。
 * - 部分唯一索引 (tenant_id, key) WHERE owner_user_id IS NULL:同租户同 key 只能有
 *   一条共享记录,避免两个管理员各配一条、运行期随机命中。
 *
 * app_secret 以 enc:v1 AES-256-GCM 密文落库,永不存明文、永不进响应体。
 */
export const connectorInstances = pgTable(
  'connector_instances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    /** NULL = 租户共享;非 NULL = 个人作用域属主 users.id */
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** 属主内唯一标识,格式 {type}:{slug} */
    key: text('key').notNull(),
    /** 连接器类型:yuque | feishu | wecom | dingtalk | wechat_mp | custom */
    connType: varchar('conn_type', { length: 32 }).notNull(),
    name: text('name').default('').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    appId: varchar('app_id', { length: 255 }).default('').notNull(),
    /** app_secret:enc:v1 密文;空串表示尚未配置 */
    appSecret: text('app_secret').default('').notNull(),
    extra: jsonb('extra').default({}).notNull(),
    mode: varchar('mode', { length: 16 }).default('preset').notNull(),
    spec: jsonb('spec').default({}).notNull(),
    operations: jsonb('operations').default([]).notNull(),
    managed: boolean('managed').default(false).notNull(),
    credentialSource: text('credential_source').default('').notNull(),
    installedAt: text('installed_at').default('').notNull(),
    lastSyncAt: text('last_sync_at').default('').notNull(),
    lastError: text('last_error').default('').notNull(),
    syncItems: jsonb('sync_items').default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /** 个人作用域行唯一;共享行(owner_user_id IS NULL)不参与本索引 */
    ownerKeyUq: uniqueIndex('connector_instances_owner_key_uidx').on(
      t.tenantId,
      t.ownerUserId,
      t.key,
    ),
    /** 租户共享行唯一:同租户同 key 仅一条共享记录 */
    sharedKeyUq: uniqueIndex('connector_instances_tenant_key_shared_uidx')
      .on(t.tenantId, t.key)
      .where(sql`${t.ownerUserId} IS NULL`),
    tenantOwnerIdx: index('connector_instances_tenant_owner_idx').on(t.tenantId, t.ownerUserId),
  }),
)

export type ConnectorInstance = typeof connectorInstances.$inferSelect
export type NewConnectorInstance = typeof connectorInstances.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
