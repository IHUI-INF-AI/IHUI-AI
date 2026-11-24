// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 费用报销闭环(2026-11-24 四波立)。
 *
 * 原缺口:"报销没有审批流、没有发票验真、不入账"——本表把三段接起来:
 *   submitted(带审批链快照) → approved/rejected(逐级留痕) → paid(付款留痕)
 *   → link-voucher(生成正式账凭证,幂等 sourceRef=expense:<id>)。
 * 审批链**提交时刻固化**在单上(与 hr_approval_instance 同纪律:规则后改不影响在飞单);
 * 验真走 invoice-verify 现成分层(本地勾稽必做,外部查验注册才可用)。
 */
import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
  numeric,
  text,
} from 'drizzle-orm/pg-core'

import { finLedger, finVoucher } from './fin-accounting.js'
import { hrEmployee } from './hr-ai-management.js'
import { users } from './users.js'

/** 单据状态封闭集(与路由 zod enum、服务状态机同源) */
export const EXPENSE_STATUSES = ['submitted', 'approved', 'rejected', 'paid', 'voided'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

/** 六类费用(与 ai-service 报销合规判定的分类族一致) */
export const EXPENSE_CATEGORIES = [
  'travel',
  'entertainment',
  'education',
  'welfare',
  'office',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface ExpenseStep {
  approver: string
  action: 'approve' | 'reject'
  at: string
  comment?: string
}

export const hrExpenseClaim = pgTable(
  'hr_expense_claim',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'restrict' }),
    /** 入账目标账套;null ⇒ 只走审批付款,不入正式账(临时/未建账主体) */
    ledgerId: uuid('ledger_id').references(() => finLedger.id, { onDelete: 'set null' }),
    category: varchar('category', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    /** 票据影像引用(与凭证附件同形:{fileId,name,url,sha256?}),提交必填 ≥1 */
    vouchers: jsonb('vouchers')
      .$type<Array<{ fileId: string; name: string; url: string; sha256?: string }>>()
      .notNull(),
    /** 提交时刻固化的审批链(用户 id 数组,长度 ≥1;后改规则不影响在飞单) */
    approverChain: jsonb('approver_chain').$type<string[]>().notNull(),
    /** 当前待审步(0 起,指向 approverChain 下标) */
    currentStep: integer('current_step').default(0).notNull(),
    /** 逐级轨迹 */
    steps: jsonb('steps').$type<ExpenseStep[]>().default([]).notNull(),
    status: varchar('status', { length: 20 }).default('submitted').notNull(),
    /** 付款 */
    paymentMethod: varchar('payment_method', { length: 20 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** 入账凭证(幂等:一张报销单最多一枚) */
    voucherId: uuid('voucher_id').references(() => finVoucher.id, { onDelete: 'set null' }),
    voucherNo: varchar('voucher_no', { length: 30 }),
    note: text('note'),
    submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    empIdx: index('ix_hr_expense_claim_emp').on(t.employeeId, t.status),
    ledgerIdx: index('ix_hr_expense_claim_ledger').on(t.ledgerId, t.status),
    activeIdx: index('ix_hr_expense_claim_active').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    // 注:"一票一单"不做库级唯一约束(jsonb 数组元素列级表达不出真语义,
    // 假约束 = 有声明无拦截);查重由 service.assertNoVoucherReuse 逐条真查,
    // 与凭证附件同一形态,失效方向是"多拦一次"而非"静默放过"。
  }),
)
export type HrExpenseClaim = typeof hrExpenseClaim.$inferSelect
export type NewHrExpenseClaim = typeof hrExpenseClaim.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
