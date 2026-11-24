// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发薪闭环(2026-11-23 立):代发批次 + 工资条。
 *
 * 为什么需要它:此前算薪只到 hr_payroll_item(每人应发/实发),再往下的三步全是断的 ——
 *   ① 没有收款账户 ⇒ 生成不了银行代发文件,出纳必须手工誊一遍;
 *   ② 没有工资条 ⇒ 员工不知道自己的钱怎么算出来的,HR 被追问时只能翻 Excel;
 *   ③ 没有签收 ⇒ 发出去没有回执,争议时无法证明"已告知"。
 *
 * 本文件把这三步变成台账:批次(hr_payroll_payout) → 工资条(hr_payslip) → 签收。
 * 银行文件本身不落盘:导出接口直接返回文本,由调用方下载/上传,避免把含卡号的文件
 * 写进服务器磁盘成为新的泄露面。
 */

import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users.js'
import { hrEmployee } from './hr-ai-management.js'
import { hrPayrollItem, hrPayrollPeriod } from './hr-attendance-monthly.js'

/** 代发批次:一次发薪对应一个批次(同月可重出,以最新 exported 批次为准)。 */
export const hrPayrollPayout = pgTable(
  'hr_payroll_payout',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => hrPayrollPeriod.id, { onDelete: 'cascade' }),
    periodMonth: varchar('period_month', { length: 7 }).notNull(),
    /** draft=已算出待导出 / exported=已生成文件 / submitted=已交银行 / paid=已到账 / failed=退回 */
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    /** 导出文件指纹(sha256 前 32 位)与行数,用于"发出的到底是哪一份"追溯 */
    fileHash: varchar('file_hash', { length: 64 }),
    fileRows: integer('file_rows').default(0).notNull(),
    headCount: integer('head_count').default(0).notNull(),
    totalAmount: numeric('total_amount', { precision: 16, scale: 2 }).default('0.00').notNull(),
    /** 缺收款账户的员工(JSON 数组:工号+姓名),导出时逐条点名 */
    missingAccounts: jsonb('missing_accounts').$type<Array<{ employeeNo: string; name: string }>>(),
    exportedAt: timestamp('exported_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    operatorId: uuid('operator_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodIdx: index('ix_hr_payout_period').on(t.periodMonth, t.status),
  }),
)

/** 工资条:一人一月一条,内容在生成时冻结快照(后续改配置不影响已发工资条)。 */
export const hrPayslip = pgTable(
  'hr_payslip',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => hrPayrollPeriod.id, { onDelete: 'cascade' }),
    periodMonth: varchar('period_month', { length: 7 }).notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    payrollItemId: uuid('payroll_item_id')
      .notNull()
      .references(() => hrPayrollItem.id, { onDelete: 'cascade' }),
    /** generated=已生成 / pushed=已推送 / acknowledged=员工已签收 */
    status: varchar('status', { length: 20 }).default('generated').notNull(),
    /** 快照:姓名/工号/应发/各扣除/实发/计算明细摘要 */
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>(),
    channel: varchar('channel', { length: 30 }),
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    /** 签收方式:inapp/email/sms/paper,争议时可追 */
    ackChannel: varchar('ack_channel', { length: 30 }),
    remark: text('remark'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodEmpUq: uniqueIndex('uq_hr_payslip_period_emp').on(t.periodId, t.employeeId),
    statusIdx: index('ix_hr_payslip_status').on(t.periodMonth, t.status),
  }),
)

export type HrPayrollPayout = typeof hrPayrollPayout.$inferSelect
export type NewHrPayrollPayout = typeof hrPayrollPayout.$inferInsert
export type HrPayslip = typeof hrPayslip.$inferSelect
export type NewHrPayslip = typeof hrPayslip.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
