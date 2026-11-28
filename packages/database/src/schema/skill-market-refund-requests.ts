// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * 技能市场退款申请（2026-11-28 立）。
 *
 * 买家先提交申请，运营审核后才调用退款；申请本身不动钱。
 * `purchase_id` 不设外键，购买账本被清理时申请仍保留审计；
 * 已退款/已拒绝的申请不会阻止再次申请，但同一购买同时只能有一条 pending。
 */
export const skillMarketRefundRequests = pgTable(
  'skill_market_refund_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    purchaseId: uuid('purchase_id').notNull(),
    buyerUserId: uuid('buyer_user_id').notNull(),
    sellerUserId: uuid('seller_user_id'),
    /** 买家填写的申请原因，运营审核依据；不强制和最终退款原因相同。 */
    reason: varchar('reason', { length: 500 }).notNull(),
    /** pending = 待审核；approved = 已退款；rejected = 已拒绝；cancelled = 买家撤回。 */
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    reviewedBy: uuid('reviewed_by'),
    reviewNote: varchar('review_note', { length: 500 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // 同一购买只允许一条待审核申请；退款后再次购买可重新申请。
    pendingUniq: uniqueIndex('skill_market_refund_requests_pending_uniq')
      .on(t.purchaseId)
      .where(sql`${t.status} = 'pending'`),
    buyerStatusIdx: index('skill_market_refund_requests_buyer_status_idx').on(
      t.buyerUserId,
      t.status,
    ),
    statusCreatedIdx: index('skill_market_refund_requests_status_created_idx').on(
      t.status,
      t.createdAt,
    ),
    purchaseIdx: index('skill_market_refund_requests_purchase_idx').on(t.purchaseId),
  }),
)

export type SkillMarketRefundRequest = typeof skillMarketRefundRequests.$inferSelect
export type NewSkillMarketRefundRequest = typeof skillMarketRefundRequests.$inferInsert
