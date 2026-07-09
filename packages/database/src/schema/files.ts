import { pgTable, uuid, varchar, bigint, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { projects } from './projects.js';

/**
 * 项目文件表。
 * size 以字节为单位（bigint）。path 为服务端存储路径，下载时按 id 查询后返回流。
 */
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  path: varchar('path', { length: 512 }).notNull(),
  size: bigint('size', { mode: 'number' }).default(0).notNull(),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  uploadedBy: uuid('uploaded_by')
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // 软删除（回收站）：deletedAt 非空表示已移入回收站
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
});

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
