import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 存储驱动配置表 - 管理 edu_platform 的对象存储驱动(local/aliyun-oss/tencent-cos/qiniu 等)。
 * 与 files 表区分:files 记录文件元数据,本表记录存储驱动配置。
 * credentials 以 jsonb 存储(密钥/endpoint/bucket 等,建议业务层加密)。
 * isDefault=true 表示当前启用的默认驱动(全局唯一,业务层保证)。
 */
export const ossDrivers = pgTable(
  'oss_drivers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull().unique(),
    // 驱动类型: local/aliyun-oss/tencent-cos/qiniu/s3 等
    driver: varchar('driver', { length: 32 }).notNull(),
    credentials: jsonb('credentials'),
    config: jsonb('config').default({}),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    sort: integer('sort').default(0).notNull(),
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    driverIdx: index('oss_drivers_driver_idx').on(t.driver),
    enabledIdx: index('oss_drivers_enabled_idx').on(t.isEnabled),
  }),
);

export type OssDriver = typeof ossDrivers.$inferSelect;
export type NewOssDriver = typeof ossDrivers.$inferInsert;
