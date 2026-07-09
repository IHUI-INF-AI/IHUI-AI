import { pgTable, uuid, varchar, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { files } from './files.js';

/**
 * 文件分享表。
 * shared_with 为 null 表示公开链接；permissions: 'view' | 'edit'。
 * expires_at 为 null 表示永不过期。
 */
export const fileShares = pgTable('file_shares', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileId: uuid('file_id')
    .references(() => files.id, { onDelete: 'cascade' })
    .notNull(),
  sharedBy: uuid('shared_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sharedWith: uuid('shared_with').references(() => users.id, { onDelete: 'cascade' }),
  shareToken: varchar('share_token', { length: 128 }).notNull().unique(),
  permissions: varchar('permissions', { length: 8 }).default('view').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type FileShare = typeof fileShares.$inferSelect;
export type NewFileShare = typeof fileShares.$inferInsert;

/**
 * 文件版本历史表。
 * 记录文件每次更新（上传新版本/修改）的元数据。
 */
export const fileVersions = pgTable(
  'file_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    size: integer('size').notNull(),
    path: varchar('path', { length: 512 }).notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    changeLog: text('change_log'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique().on(t.fileId, t.version),
  }),
);

export type FileVersion = typeof fileVersions.$inferSelect;
export type NewFileVersion = typeof fileVersions.$inferInsert;
