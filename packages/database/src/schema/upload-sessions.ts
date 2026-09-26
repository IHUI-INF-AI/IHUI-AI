// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pgTable, uuid, varchar, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 上传会话的状态词表 —— **唯一一份**。此前取值只写在下面的注释里,而 `checksum_mismatch`
 * 已是真终态却不在注释中(注释字典与代码字面量各说各话,而 typecheck 看不见任何一边)。
 * 分档判据(终态 / 可回收)由这两个子集给出,消费方不得再抄第三份清单。
 */
export const UPLOAD_SESSION_STATUS = {
  uploading: 'uploading',
  merging: 'merging',
  completed: 'completed',
  cancelled: 'cancelled',
  checksumMismatch: 'checksum_mismatch',
} as const

export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUS)[keyof typeof UPLOAD_SESSION_STATUS]

/** 终态:永不回收(completed 行要留给业务查文件,cancelled 的目录已由 cancel 清过)。 */
export const UPLOAD_SESSION_TERMINAL_STATUSES: readonly UploadSessionStatus[] = [
  UPLOAD_SESSION_STATUS.completed,
  UPLOAD_SESSION_STATUS.cancelled,
  UPLOAD_SESSION_STATUS.checksumMismatch,
]

/** 可回收态:未到期前停在这些状态才可能被 TTL 删掉。 */
export const UPLOAD_SESSION_REAPABLE_STATUSES: readonly UploadSessionStatus[] = [
  UPLOAD_SESSION_STATUS.uploading,
  UPLOAD_SESSION_STATUS.merging,
]

/**
 * 分片上传会话表。
 * 记录大文件分片上传的进度与最终合并产物。
 * status 取值见 `UPLOAD_SESSION_STATUS`(本文件导出),不得在此重复列一遍清单。
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
    status: varchar('status', { length: 32 }).default(UPLOAD_SESSION_STATUS.uploading).notNull(), // 取值见本文件 UPLOAD_SESSION_STATUS
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
