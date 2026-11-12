// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 考勤导入与核对表(HR-5 第 2 期,2026-11-12 立)。
 * 准确性闸门:导入先入暂存表(hr_import_row),核对 + 人工裁决通过才写正式考勤表,绝不自动覆盖。
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  uuid,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core'
import { files } from './files.js'
import { users } from './users.js'

/**
 * 考勤导入批次 (hr_import_batch)。
 * fileHash(SHA-256) 防重复导入;mappingConfig 存 AI 识别的列→字段映射(需人确认)。
 * status: parsing → mapped → pending_review → verified / rejected
 */
export const hrImportBatch = pgTable(
  'hr_import_batch',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 考勤月份 YYYY-MM */
    periodMonth: varchar('period_month', { length: 7 }).notNull(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileHash: varchar('file_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).default('parsing').notNull(),
    totalRows: integer('total_rows').default(0).notNull(),
    matchedRows: integer('matched_rows').default(0).notNull(),
    conflictRows: integer('conflict_rows').default(0).notNull(),
    notFoundRows: integer('not_found_rows').default(0).notNull(),
    /** AI 字段映射结果: { "工号": "employeeNo", "上班打卡": "checkInTime", ... } */
    mappingConfig: jsonb('mapping_config'),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodIdx: index('ix_hr_imp_batch_period').on(t.periodMonth),
    hashIdx: index('ix_hr_imp_batch_hash').on(t.fileHash),
  }),
)

/**
 * 导入行明细 (hr_import_row)。
 * matchStatus: matched / conflict / not_found / duplicate。差异行必须人工裁决
 * (resolved=true)才能 confirm 写入正式考勤表 —— 绝不自动覆盖。
 */
export const hrImportRow = pgTable(
  'hr_import_row',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => hrImportBatch.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    employeeNo: varchar('employee_no', { length: 50 }),
    /** 原始行(列名→单元格值) */
    raw: jsonb('raw'),
    /** 解析后结构化(标准化字段) */
    parsed: jsonb('parsed'),
    matchStatus: varchar('match_status', { length: 20 }).default('pending').notNull(),
    /** 与系统记录的差异详情 [{field, systemValue, importValue}] */
    diffDetail: jsonb('diff_detail'),
    resolved: boolean('resolved').default(false).notNull(),
    /** adopt_import / keep_system / manual */
    resolution: varchar('resolution', { length: 20 }),
    /** 裁决后最终采用的结构化值 */
    finalValue: jsonb('final_value'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    batchIdx: index('ix_hr_imp_row_batch').on(t.batchId),
    statusIdx: index('ix_hr_imp_row_status').on(t.batchId, t.matchStatus),
    empIdx: index('ix_hr_imp_row_emp').on(t.employeeNo),
  }),
)

export type HrImportBatch = typeof hrImportBatch.$inferSelect
export type NewHrImportBatch = typeof hrImportBatch.$inferInsert
export type HrImportRow = typeof hrImportRow.$inferSelect
export type NewHrImportRow = typeof hrImportRow.$inferInsert
