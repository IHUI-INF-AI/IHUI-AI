// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { pgTable, uuid, varchar, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * 技能市场购买/分成账本（2026-11-28 立）。
 *
 * 只记“一次买断”的成功购买：价格、作者分成比例在写入时快照，后续调价
 * 不改历史行。买家与卖家都不设外键，账号注销后账本仍保留，便于对账与溯源。
 *
 * 金额单位与钱包 `user_margins.token_quantity` 一致（人民币分）：
 * - price_cents = 买家实扣金额
 * - author_share_cents = 卖家实收金额（无归属的内置条目为 0）
 * - platform_share_cents = 平台留存（price - author_share）
 *
 * 唯一索引 `(buyer_user_id, skill_name)` 保证同一用户对同一技能只扣一次；
 * 作者收益查询走 `(seller_user_id, created_at)`。
 */
export const skillMarketPurchases = pgTable(
  'skill_market_purchases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    skillName: varchar('skill_name', { length: 64 }).notNull(),
    skillVersion: varchar('skill_version', { length: 32 }).default('1.0.0').notNull(),
    /** 买家；不设外键，账号注销后账本保留。 */
    buyerUserId: uuid('buyer_user_id').notNull(),
    /** 卖家（上架者）；内置/无归属条目为 NULL，收益全部归平台。 */
    sellerUserId: uuid('seller_user_id'),
    priceCents: integer('price_cents').default(0).notNull(),
    currency: varchar('currency', { length: 8 }).default('CNY').notNull(),
    /** 写入时的作者分成比例快照（basis points，7000 = 70%）。 */
    revenueShareBps: integer('revenue_share_bps').default(0).notNull(),
    authorShareCents: integer('author_share_cents').default(0).notNull(),
    platformShareCents: integer('platform_share_cents').default(0).notNull(),
    /** paid = 已扣款；free = 免费领取（当前免费技能不落本表，保留枚举给后续活动）。 */
    status: varchar('status', { length: 16 }).default('paid').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    buyerSkillUniq: uniqueIndex('skill_market_purchases_buyer_skill_uniq').on(
      t.buyerUserId,
      t.skillName,
    ),
    sellerTimeIdx: index('skill_market_purchases_seller_time_idx').on(t.sellerUserId, t.createdAt),
  }),
)

export type SkillMarketPurchase = typeof skillMarketPurchases.$inferSelect
export type NewSkillMarketPurchase = typeof skillMarketPurchases.$inferInsert
