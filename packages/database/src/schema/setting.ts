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
 * edu_platform 教育平台设置表 - 键值对配置,按 group 分组。
 * 与 system_configs 区分:本表存储教育平台特有设置(站点配置/SEO/水印/存储配置等)。
 * - group: 配置分组(site/seo/watermark/storage/notification 等)
 * - key: 配置键(同 group 内唯一)
 * - value: 字符串值(数字/布尔/json 也以字符串存储,业务层按 type 解析)
 * - credentials: jsonb 凭证字段(密钥/token 等,建议业务层加密)
 * - isPublic: 公开配置可被未登录用户读取(GET /api/settings)
 */
export const eduSettings = pgTable(
  'edu_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    group: varchar('group', { length: 64 }).default('general').notNull(),
    key: varchar('key', { length: 128 }).notNull(),
    value: text('value'),
    type: varchar('type', { length: 16 }).default('string').notNull(),
    credentials: jsonb('credentials'),
    description: text('description'),
    isPublic: boolean('is_public').default(false).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    groupIdx: index('edu_settings_group_idx').on(t.group),
    groupKeyIdx: index('edu_settings_group_key_idx').on(t.group, t.key),
    publicIdx: index('edu_settings_public_idx').on(t.isPublic),
  }),
);

export type EduSetting = typeof eduSettings.$inferSelect;
export type NewEduSetting = typeof eduSettings.$inferInsert;
