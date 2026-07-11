import { pgTable, uuid, varchar, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 分片上传会话表。
 * 记录大文件分片上传的进度与最终合并产物。
 * status: uploading(上传中) / merging(合并中) / completed(已完成) / cancelled(已取消)
 */
export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uploadId: varchar('upload_id', { length: 128 }).notNull().unique(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).default(0).notNull(),
    fileMd5: varchar('file_md5', { length: 64 }),
    totalChunks: integer('total_chunks').notNull(),
    uploadedChunks: integer('uploaded_chunks').default(0).notNull(),
    chunkSize: integer('chunk_size')
      .default(5 * 1024 * 1024)
      .notNull(),
    mimeType: varchar('mime_type', { length: 128 }),
    status: varchar('status', { length: 32 }).default('uploading').notNull(), // uploading/merging/completed/cancelled
    filePath: varchar('file_path', { length: 512 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    uploadIdIdx: index('upload_sessions_upload_id_idx').on(t.uploadId),
    userIdIdx: index('upload_sessions_user_idx').on(t.userId),
    statusIdx: index('upload_sessions_status_idx').on(t.status),
  }),
)

export type UploadSession = typeof uploadSessions.$inferSelect
export type NewUploadSession = typeof uploadSessions.$inferInsert
