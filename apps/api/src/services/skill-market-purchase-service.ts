// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 技能市场购买与作者分成服务（2026-11-28 立）。
 *
 * 与“安装”分开：安装只复制条目元数据到用户私有库；购买才发生钱包扣款。
 * 金额单位与钱包一致（人民币分），不做 VIP 折扣 —— 市场标价是作者定价，
 * 平台折扣不能由作者承担。
 *
 * 一致性边界：
 * - 买家扣款、卖家入账、购买账本三件事在同一个数据库事务里完成；
 * - 购买账本先以唯一键 `(buyer_user_id, skill_name)` 抢占，重复购买不再扣款；
 * - 余额不足抛 `InsufficientSkillFundsError`，整个事务回滚（不会留下半笔账）。
 */
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { skillMarketPurchases, tokenFlows, userMargins } from '@ihui/database'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'

const DEFAULT_AUTHOR_SHARE_BPS = 7000

/** 平台作者分成比例（basis points）。非法/缺省回落 70%，0 是合法值（全归平台）。 */
export function resolveSkillAuthorShareBps(raw = process.env.SKILL_MARKET_AUTHOR_SHARE_BPS): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_AUTHOR_SHARE_BPS
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 10000) return DEFAULT_AUTHOR_SHARE_BPS
  return value
}

/** 纯计算：按价格与分成比例拆分作者/平台金额；无卖家时作者分为 0。 */
export function computeSkillRevenueSplit(input: {
  priceCents: number
  revenueShareBps: number
  hasSeller: boolean
}): { authorShareCents: number; platformShareCents: number } {
  const price = Number.isInteger(input.priceCents) && input.priceCents > 0 ? input.priceCents : 0
  const bps =
    Number.isInteger(input.revenueShareBps) &&
    input.revenueShareBps >= 0 &&
    input.revenueShareBps <= 10000
      ? input.revenueShareBps
      : DEFAULT_AUTHOR_SHARE_BPS
  const authorShareCents = input.hasSeller ? Math.floor((price * bps) / 10000) : 0
  return { authorShareCents, platformShareCents: price - authorShareCents }
}

export class InsufficientSkillFundsError extends Error {
  readonly requiredCents: number
  readonly balanceCents: number

  constructor(requiredCents: number, balanceCents: number) {
    super('insufficient wallet balance for skill purchase')
    this.name = 'InsufficientSkillFundsError'
    this.requiredCents = requiredCents
    this.balanceCents = balanceCents
  }
}

/**
 * 购买一个付费技能。调用方必须先确认 entry.priceCents > 0 且买家不是 owner。
 * 返回 `charged=false` 表示此前已购买，本次未重复扣款。
 */
export async function purchasePaidSkill(input: {
  buyerUserId: string
  entry: SkillMarketEntry
}): Promise<{
  charged: boolean
  alreadyPurchased: boolean
  authorShareCents: number
  platformShareCents: number
  balanceAfter: number | null
}> {
  const { buyerUserId, entry } = input
  const priceCents = Number.isInteger(entry.priceCents) ? (entry.priceCents as number) : 0
  if (priceCents <= 0) {
    throw new Error('purchasePaidSkill requires a positive priceCents')
  }

  const sellerUserId =
    entry.ownerId && entry.ownerId !== buyerUserId ? entry.ownerId : null
  const revenueShareBps = Number.isInteger(entry.revenueShareBps)
    ? (entry.revenueShareBps as number)
    : resolveSkillAuthorShareBps()
  const { authorShareCents, platformShareCents } = computeSkillRevenueSplit({
    priceCents,
    revenueShareBps,
    hasSeller: sellerUserId !== null,
  })

  return db.transaction(async (tx) => {
    // 先抢占购买账本唯一键：重复购买（含并发）在这里被挡住，不会先扣款。
    const [inserted] = await tx
      .insert(skillMarketPurchases)
      .values({
        skillName: entry.name,
        skillVersion: entry.version,
        buyerUserId,
        sellerUserId,
        priceCents,
        revenueShareBps,
        authorShareCents,
        platformShareCents,
        status: 'paid',
      })
      .onConflictDoNothing()
      .returning()

    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(skillMarketPurchases)
        .where(
          and(
            eq(skillMarketPurchases.buyerUserId, buyerUserId),
            eq(skillMarketPurchases.skillName, entry.name),
          ),
        )
        .limit(1)
      if (existing) {
        return {
          charged: false,
          alreadyPurchased: true,
          authorShareCents: existing.authorShareCents,
          platformShareCents: existing.platformShareCents,
          balanceAfter: null,
        }
      }
      throw new Error('skill purchase conflict without existing record')
    }

    // 买家扣款：WHERE 余额 >= 价格，避免 check-then-act 竞态。
    const [debited] = await tx
      .update(userMargins)
      .set({
        tokenQuantity: sql`${userMargins.tokenQuantity} - ${priceCents}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userMargins.userId, buyerUserId),
          sql`${userMargins.tokenQuantity} >= ${priceCents}`,
        ),
      )
      .returning({ tokenQuantity: userMargins.tokenQuantity })

    if (!debited) {
      const [row] = await tx
        .select({ tokenQuantity: userMargins.tokenQuantity })
        .from(userMargins)
        .where(eq(userMargins.userId, buyerUserId))
        .limit(1)
      throw new InsufficientSkillFundsError(priceCents, row?.tokenQuantity ?? 0)
    }

    await tx.insert(tokenFlows).values({
      userId: buyerUserId,
      opType: 1,
      quantity: priceCents,
      balanceAfter: debited.tokenQuantity,
      remark: `skill_market_purchase:${entry.name}`.slice(0, 255),
      relatedOrderNo: inserted.id,
    })

    // 卖家入账：只在有归属且分成 > 0 时发生；与买家扣款同事务，避免平台吞作者收益。
    if (sellerUserId && authorShareCents > 0) {
      const [credited] = await tx
        .insert(userMargins)
        .values({
          userId: sellerUserId,
          tokenQuantity: authorShareCents,
          frozenQuantity: 0,
        })
        .onConflictDoUpdate({
          target: userMargins.userId,
          set: {
            tokenQuantity: sql`${userMargins.tokenQuantity} + ${authorShareCents}`,
            updatedAt: new Date(),
          },
        })
        .returning({ tokenQuantity: userMargins.tokenQuantity })

      await tx.insert(tokenFlows).values({
        userId: sellerUserId,
        opType: 0,
        quantity: authorShareCents,
        balanceAfter: credited?.tokenQuantity ?? authorShareCents,
        remark: `skill_market_author_share:${entry.name}`.slice(0, 255),
        relatedOrderNo: inserted.id,
      })
    }

    return {
      charged: true,
      alreadyPurchased: false,
      authorShareCents,
      platformShareCents,
      balanceAfter: debited.tokenQuantity,
    }
  })
}

/** 该买家是否已购买过这个付费技能（付费安装闸用）。 */
export async function hasPurchasedSkill(buyerUserId: string, skillName: string): Promise<boolean> {
  const [row] = await db
    .select({ id: skillMarketPurchases.id })
    .from(skillMarketPurchases)
    .where(
      and(
        eq(skillMarketPurchases.buyerUserId, buyerUserId),
        eq(skillMarketPurchases.skillName, skillName),
        eq(skillMarketPurchases.status, 'paid'),
      ),
    )
    .limit(1)
  return Boolean(row)
}

interface EarningsSummaryRow {
  total: string | number
  records: string | number
  lastEarnedAt: Date | string | null
}

/** 作者收益汇总 + 最近 20 笔。金额单位为分，直接来自购买账本。 */
export async function getSkillEarnings(sellerUserId: string): Promise<{
  totalAuthorShareCents: number
  currency: string
  records: number
  lastEarnedAt: string | null
  items: Array<{
    id: string
    skillName: string
    buyerUserId: string
    priceCents: number
    authorShareCents: number
    revenueShareBps: number
    createdAt: string
  }>
}> {
  const [summary] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${skillMarketPurchases.authorShareCents}), 0)`,
      records: sql<string>`COUNT(*)`,
      lastEarnedAt: sql<Date | string | null>`MAX(${skillMarketPurchases.createdAt})`,
    })
    .from(skillMarketPurchases)
    .where(
      and(
        eq(skillMarketPurchases.sellerUserId, sellerUserId),
        eq(skillMarketPurchases.status, 'paid'),
      ),
    )
    .limit(1)

  const rows = await db
    .select({
      id: skillMarketPurchases.id,
      skillName: skillMarketPurchases.skillName,
      buyerUserId: skillMarketPurchases.buyerUserId,
      priceCents: skillMarketPurchases.priceCents,
      authorShareCents: skillMarketPurchases.authorShareCents,
      revenueShareBps: skillMarketPurchases.revenueShareBps,
      createdAt: skillMarketPurchases.createdAt,
    })
    .from(skillMarketPurchases)
    .where(
      and(
        eq(skillMarketPurchases.sellerUserId, sellerUserId),
        eq(skillMarketPurchases.status, 'paid'),
      ),
    )
    .orderBy(sql`${skillMarketPurchases.createdAt} DESC`)
    .limit(20)

  const row = summary as EarningsSummaryRow | undefined
  return {
    totalAuthorShareCents: Number(row?.total ?? 0),
    currency: 'CNY',
    records: Number(row?.records ?? 0),
    lastEarnedAt: row?.lastEarnedAt ? new Date(row.lastEarnedAt).toISOString() : null,
    items: rows.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt).toISOString(),
    })),
  }
}
