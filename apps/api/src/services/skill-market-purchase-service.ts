// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db/index.js'
import { createCommissionFlow } from '../db/commission-queries.js'
import {
  commissionFlows,
  skillMarketPurchases,
  skillMarketRefundRequests,
  tokenFlows,
  userMargins,
  users,
  withdrawalFlows,
} from '@ihui/database'
import type {
  AdminSkillRefundRequestItem,
  AdminSkillRefundRequestListResponse,
  AdminSkillRefundRequestReviewResponse,
  SkillEarningsResponse,
  SkillMarketEntry,
  SkillMarketSettlementPeriod,
  SkillMarketSettlementResponse,
  SkillMarketSettlementRow,
  SkillMarketSettlementTotals,
  SkillMyPurchasesResponse,
  SkillRefundRequestCreateResponse,
  SkillRefundRequestSummary,
  SkillSellerAccountFlag,
  SkillSellerAccountsResponse,
} from '@ihui/shared/skills/market'

const buyerUser = alias(users, 'skill_market_buyer')
const sellerUser = alias(users, 'skill_market_seller')

const DEFAULT_AUTHOR_SHARE_BPS = 7000

/** 平台作者分成比例（basis points）。非法/缺省回落 70%，0 是合法值（全归平台）。 */
export function resolveSkillAuthorShareBps(
  raw = process.env.SKILL_MARKET_AUTHOR_SHARE_BPS,
): number {
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

  const sellerUserId = entry.ownerId && entry.ownerId !== buyerUserId ? entry.ownerId : null
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

      // 把作者分成登记为“可提现佣金”:钱包余额已经入账,但现有提现入口按
      // commission_flows 统计可提额度;不补这笔,作者只能看到余额却提不出来。
      // token=0:钱已在上面入账,这里只增加佣金可提额度,不再重复加钱。
      const commissionFlow = await createCommissionFlow(
        {
          beneficiaryId: sellerUserId,
          invitedUserId: buyerUserId,
          amount: authorShareCents,
          token: 0,
          type: 3,
          remark: `skill_market_author_share:${inserted.id}:${entry.name}`.slice(0, 255),
        },
        null,
        tx,
      )
      // 退款按购买账本上的流水 ID 精确冲正，不再依赖 remark 字符串匹配。
      await tx
        .update(skillMarketPurchases)
        .set({ commissionFlowId: commissionFlow.id })
        .where(eq(skillMarketPurchases.id, inserted.id))
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

export class SkillPurchaseNotFoundError extends Error {
  constructor() {
    super('skill purchase not found')
    this.name = 'SkillPurchaseNotFoundError'
  }
}

export interface AdminSkillMarketPurchaseRow {
  id: string
  skillName: string
  skillVersion: string
  buyerUserId: string
  buyerNickname: string | null
  sellerUserId: string | null
  sellerNickname: string | null
  priceCents: number
  currency: string
  revenueShareBps: number
  authorShareCents: number
  platformShareCents: number
  status: string
  createdAt: Date
  refundedAt: Date | null
  refundAmountCents: number
  /** 实际从卖家余额扣回的分成；NULL = 历史退款未记录。 */
  sellerClawbackCents: number | null
  refundReason: string | null
}

/**
 * 管理员交易列表：按状态/关键词筛选，按创建时间倒序分页。
 *
 * 关键词命中购买 ID、技能名、买家/卖家昵称；不把 UUID 精确匹配拆成单独的
 * 查询分支，避免管理员复制购买 ID 时因大小写或前后空格查不到。
 */
export async function listSkillMarketPurchasesAdmin(input: {
  status?: 'paid' | 'refunded'
  keyword?: string
  page: number
  pageSize: number
}): Promise<{ items: AdminSkillMarketPurchaseRow[]; total: number }> {
  const conditions = []
  if (input.status) conditions.push(eq(skillMarketPurchases.status, input.status))
  const keyword = input.keyword?.trim()
  if (keyword) {
    const pattern = `%${keyword}%`
    conditions.push(
      or(
        ilike(sql`${skillMarketPurchases.id}::text`, pattern),
        ilike(skillMarketPurchases.skillName, pattern),
        ilike(buyerUser.nickname, pattern),
        ilike(sellerUser.nickname, pattern),
      ),
    )
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: skillMarketPurchases.id,
        skillName: skillMarketPurchases.skillName,
        skillVersion: skillMarketPurchases.skillVersion,
        buyerUserId: skillMarketPurchases.buyerUserId,
        buyerNickname: buyerUser.nickname,
        sellerUserId: skillMarketPurchases.sellerUserId,
        sellerNickname: sellerUser.nickname,
        priceCents: skillMarketPurchases.priceCents,
        currency: skillMarketPurchases.currency,
        revenueShareBps: skillMarketPurchases.revenueShareBps,
        authorShareCents: skillMarketPurchases.authorShareCents,
        platformShareCents: skillMarketPurchases.platformShareCents,
        status: skillMarketPurchases.status,
        createdAt: skillMarketPurchases.createdAt,
        refundedAt: skillMarketPurchases.refundedAt,
        refundAmountCents: skillMarketPurchases.refundAmountCents,
        sellerClawbackCents: skillMarketPurchases.sellerClawbackCents,
        refundReason: skillMarketPurchases.refundReason,
      })
      .from(skillMarketPurchases)
      .leftJoin(buyerUser, eq(skillMarketPurchases.buyerUserId, buyerUser.id))
      .leftJoin(sellerUser, eq(skillMarketPurchases.sellerUserId, sellerUser.id))
      .where(where)
      .orderBy(desc(skillMarketPurchases.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(skillMarketPurchases)
      .leftJoin(buyerUser, eq(skillMarketPurchases.buyerUserId, buyerUser.id))
      .leftJoin(sellerUser, eq(skillMarketPurchases.sellerUserId, sellerUser.id))
      .where(where),
  ])

  return { items: rows, total: totalRows[0]?.count ?? 0 }
}

export class SkillRefundRequestNotFoundError extends Error {
  constructor(message = '退款申请不存在') {
    super(message)
    this.name = 'SkillRefundRequestNotFoundError'
  }
}

export class SkillRefundRequestStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillRefundRequestStateError'
  }
}

type RefundRequestStatus = SkillRefundRequestSummary['status']

function normalizeRefundRequestStatus(status: string): RefundRequestStatus {
  return status === 'approved' || status === 'rejected' || status === 'cancelled'
    ? status
    : 'pending'
}

function toRefundRequestSummary(row: {
  id: string
  status: string
  reason: string
  reviewNote: string | null
  createdAt: Date
  reviewedAt: Date | null
}): SkillRefundRequestSummary {
  return {
    id: row.id,
    status: normalizeRefundRequestStatus(row.status),
    reason: row.reason,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }
}

/**
 * 买家“我的购买”列表：只返回自己的购买与最近一次退款申请。
 * 不返回卖家/作者分成信息，买家只需要知道成交价与退款进度。
 */
export async function listSkillMyPurchases(buyerUserId: string): Promise<SkillMyPurchasesResponse> {
  const rows = await db
    .select({
      id: skillMarketPurchases.id,
      skillName: skillMarketPurchases.skillName,
      priceCents: skillMarketPurchases.priceCents,
      currency: skillMarketPurchases.currency,
      status: skillMarketPurchases.status,
      createdAt: skillMarketPurchases.createdAt,
      refundedAt: skillMarketPurchases.refundedAt,
      refundAmountCents: skillMarketPurchases.refundAmountCents,
    })
    .from(skillMarketPurchases)
    .where(eq(skillMarketPurchases.buyerUserId, buyerUserId))
    .orderBy(desc(skillMarketPurchases.createdAt))

  const purchaseIds = rows.map((row) => row.id)
  const requests =
    purchaseIds.length > 0
      ? await db
          .select({
            id: skillMarketRefundRequests.id,
            purchaseId: skillMarketRefundRequests.purchaseId,
            status: skillMarketRefundRequests.status,
            reason: skillMarketRefundRequests.reason,
            reviewNote: skillMarketRefundRequests.reviewNote,
            createdAt: skillMarketRefundRequests.createdAt,
            reviewedAt: skillMarketRefundRequests.reviewedAt,
          })
          .from(skillMarketRefundRequests)
          .where(inArray(skillMarketRefundRequests.purchaseId, purchaseIds))
          .orderBy(desc(skillMarketRefundRequests.createdAt))
      : []

  // 同一购买可能有多条历史申请（被拒后重提）；按时间倒序取第一条作为“最近一次”。
  const latestByPurchase = new Map<string, (typeof requests)[number]>()
  for (const request of requests) {
    if (!latestByPurchase.has(request.purchaseId)) latestByPurchase.set(request.purchaseId, request)
  }

  const items = rows.map((row) => {
    const latest = latestByPurchase.get(row.id)
    const purchaseStatus = row.status === 'refunded' ? ('refunded' as const) : ('paid' as const)
    return {
      id: row.id,
      skillName: row.skillName,
      priceCents: row.priceCents,
      currency: row.currency,
      status: purchaseStatus,
      createdAt: row.createdAt.toISOString(),
      refundedAt: row.refundedAt?.toISOString() ?? null,
      refundAmountCents: row.refundAmountCents,
      refundRequest: latest ? toRefundRequestSummary(latest) : null,
      canRequestRefund: purchaseStatus === 'paid' && latest?.status !== 'pending',
    }
  })

  return { items, total: items.length }
}

/**
 * 买家提交退款申请。只写申请，不动钱；运营审核通过后才调用退款事务。
 * 同一购买已有待审申请时按幂等处理，返回已有申请而不是报错。
 */
export async function createSkillRefundRequest(input: {
  purchaseId: string
  buyerUserId: string
  reason: string
}): Promise<SkillRefundRequestCreateResponse> {
  const reason = input.reason.trim()
  if (reason.length < 5) throw new SkillRefundRequestStateError('退款原因至少 5 个字')
  if (reason.length > 500) throw new SkillRefundRequestStateError('退款原因最多 500 个字')

  return db.transaction(async (tx) => {
    const [purchase] = await tx
      .select({
        id: skillMarketPurchases.id,
        buyerUserId: skillMarketPurchases.buyerUserId,
        sellerUserId: skillMarketPurchases.sellerUserId,
        status: skillMarketPurchases.status,
      })
      .from(skillMarketPurchases)
      .where(
        and(
          eq(skillMarketPurchases.id, input.purchaseId),
          eq(skillMarketPurchases.buyerUserId, input.buyerUserId),
        ),
      )
      .limit(1)
      .for('update')

    if (!purchase) throw new SkillRefundRequestNotFoundError('购买记录不存在或不属于当前用户')
    if (purchase.status !== 'paid') throw new SkillRefundRequestStateError('该笔购买已退款，无需重复申请')

    const [created] = await tx
      .insert(skillMarketRefundRequests)
      .values({
        purchaseId: purchase.id,
        buyerUserId: purchase.buyerUserId,
        sellerUserId: purchase.sellerUserId,
        reason,
      })
      .onConflictDoNothing()
      .returning({
        id: skillMarketRefundRequests.id,
        status: skillMarketRefundRequests.status,
        reason: skillMarketRefundRequests.reason,
        reviewNote: skillMarketRefundRequests.reviewNote,
        createdAt: skillMarketRefundRequests.createdAt,
        reviewedAt: skillMarketRefundRequests.reviewedAt,
      })

    if (created) {
      return { request: toRefundRequestSummary(created), alreadyRequested: false }
    }

    const [existing] = await tx
      .select({
        id: skillMarketRefundRequests.id,
        status: skillMarketRefundRequests.status,
        reason: skillMarketRefundRequests.reason,
        reviewNote: skillMarketRefundRequests.reviewNote,
        createdAt: skillMarketRefundRequests.createdAt,
        reviewedAt: skillMarketRefundRequests.reviewedAt,
      })
      .from(skillMarketRefundRequests)
      .where(
        and(
          eq(skillMarketRefundRequests.purchaseId, purchase.id),
          eq(skillMarketRefundRequests.status, 'pending'),
        ),
      )
      .limit(1)

    if (!existing) throw new SkillRefundRequestStateError('退款申请状态冲突，请刷新后重试')
    return { request: toRefundRequestSummary(existing), alreadyRequested: true }
  })
}

/** 管理员退款申请列表；默认按 pending 优先、时间倒序。 */
export async function listSkillRefundRequestsAdmin(input: {
  page: number
  pageSize: number
  status?: RefundRequestStatus
}): Promise<AdminSkillRefundRequestListResponse> {
  const where = input.status ? eq(skillMarketRefundRequests.status, input.status) : undefined

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: skillMarketRefundRequests.id,
        purchaseId: skillMarketRefundRequests.purchaseId,
        buyerUserId: skillMarketRefundRequests.buyerUserId,
        buyerNickname: buyerUser.nickname,
        sellerUserId: skillMarketRefundRequests.sellerUserId,
        sellerNickname: sellerUser.nickname,
        skillName: skillMarketPurchases.skillName,
        priceCents: skillMarketPurchases.priceCents,
        purchaseStatus: skillMarketPurchases.status,
        purchaseCreatedAt: skillMarketPurchases.createdAt,
        purchaseRefundedAt: skillMarketPurchases.refundedAt,
        reason: skillMarketRefundRequests.reason,
        status: skillMarketRefundRequests.status,
        reviewNote: skillMarketRefundRequests.reviewNote,
        reviewedAt: skillMarketRefundRequests.reviewedAt,
        createdAt: skillMarketRefundRequests.createdAt,
      })
      .from(skillMarketRefundRequests)
      .leftJoin(
        skillMarketPurchases,
        eq(skillMarketRefundRequests.purchaseId, skillMarketPurchases.id),
      )
      .leftJoin(buyerUser, eq(skillMarketRefundRequests.buyerUserId, buyerUser.id))
      .leftJoin(sellerUser, eq(skillMarketRefundRequests.sellerUserId, sellerUser.id))
      .where(where)
      .orderBy(
        sql`CASE WHEN ${skillMarketRefundRequests.status} = 'pending' THEN 0 ELSE 1 END`,
        desc(skillMarketRefundRequests.createdAt),
      )
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(skillMarketRefundRequests)
      .where(where),
  ])

  const items: AdminSkillRefundRequestItem[] = rows.map((row) => ({
    id: row.id,
    purchaseId: row.purchaseId,
    skillName: row.skillName ?? '（购买记录已删除）',
    buyerUserId: row.buyerUserId,
    buyerNickname: row.buyerNickname,
    sellerUserId: row.sellerUserId,
    sellerNickname: row.sellerNickname,
    priceCents: row.priceCents ?? 0,
    purchaseStatus: row.purchaseStatus === 'refunded' ? 'refunded' : 'paid',
    purchaseCreatedAt: (row.purchaseCreatedAt ?? row.createdAt).toISOString(),
    purchaseRefundedAt: row.purchaseRefundedAt?.toISOString() ?? null,
    reason: row.reason,
    status: normalizeRefundRequestStatus(row.status),
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }))

  return { items, total: totalRows[0]?.count ?? 0, page: input.page, pageSize: input.pageSize }
}

/**
 * 管理员批准退款：申请行 FOR UPDATE 串行化，退款与申请状态在同一事务内完成。
 * 退款本身幂等；若购买已由其他入口退过，仍会把申请标成 approved，不重复退钱。
 */
export async function approveSkillRefundRequest(input: {
  requestId: string
  operatorId: string | null
  note?: string
}): Promise<AdminSkillRefundRequestReviewResponse> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(skillMarketRefundRequests)
      .where(eq(skillMarketRefundRequests.id, input.requestId))
      .for('update')

    if (!request) throw new SkillRefundRequestNotFoundError()
    if (request.status === 'approved') {
      // 幂等重试仍带回购买信息，让路由可以补做安装态回收（首次审批若在 Redis 回收前中断）。
      const [purchase] = await tx
        .select({
          skillName: skillMarketPurchases.skillName,
          refundAmountCents: skillMarketPurchases.refundAmountCents,
          sellerClawbackCents: skillMarketPurchases.sellerClawbackCents,
        })
        .from(skillMarketPurchases)
        .where(eq(skillMarketPurchases.id, request.purchaseId))
        .limit(1)
      return {
        requestId: request.id,
        status: 'approved' as const,
        alreadyReviewed: true,
        refundedAmountCents: purchase?.refundAmountCents ?? 0,
        sellerClawbackCents: purchase?.sellerClawbackCents ?? 0,
        buyerBalanceAfter: null,
        purchaseId: request.purchaseId,
        skillName: purchase?.skillName ?? null,
        buyerUserId: request.buyerUserId,
      }
    }
    if (request.status !== 'pending') {
      throw new SkillRefundRequestStateError(`该申请已处理: ${request.status}`)
    }

    const refund = await refundSkillPurchaseTx(tx, {
      purchaseId: request.purchaseId,
      reason: request.reason,
      operatorId: input.operatorId,
    })

    const reviewNote = input.note?.trim().slice(0, 500) || null
    await tx
      .update(skillMarketRefundRequests)
      .set({
        status: 'approved',
        reviewedBy: input.operatorId,
        reviewNote,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(skillMarketRefundRequests.id, request.id),
          eq(skillMarketRefundRequests.status, 'pending'),
        ),
      )

    return {
      requestId: request.id,
      status: 'approved' as const,
      alreadyReviewed: false,
      refundedAmountCents: refund.refundedAmountCents,
      sellerClawbackCents: refund.sellerClawbackCents,
      buyerBalanceAfter: refund.buyerBalanceAfter,
      purchaseId: refund.purchaseId,
      skillName: refund.skillName,
      buyerUserId: refund.buyerUserId,
    }
  })
}

/** 管理员拒绝退款申请；只改申请状态，不动购买与钱。 */
export async function rejectSkillRefundRequest(input: {
  requestId: string
  operatorId: string | null
  note?: string
}): Promise<AdminSkillRefundRequestReviewResponse> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(skillMarketRefundRequests)
      .where(eq(skillMarketRefundRequests.id, input.requestId))
      .for('update')

    if (!request) throw new SkillRefundRequestNotFoundError()
    if (request.status === 'rejected') {
      return {
        requestId: request.id,
        status: 'rejected' as const,
        alreadyReviewed: true,
        refundedAmountCents: 0,
        sellerClawbackCents: 0,
        buyerBalanceAfter: null,
        purchaseId: request.purchaseId,
        skillName: null,
        buyerUserId: request.buyerUserId,
      }
    }
    if (request.status !== 'pending') {
      throw new SkillRefundRequestStateError(`该申请已处理: ${request.status}`)
    }

    const reviewNote = input.note?.trim().slice(0, 500) || null
    await tx
      .update(skillMarketRefundRequests)
      .set({
        status: 'rejected',
        reviewedBy: input.operatorId,
        reviewNote,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(skillMarketRefundRequests.id, request.id),
          eq(skillMarketRefundRequests.status, 'pending'),
        ),
      )

    return {
      requestId: request.id,
      status: 'rejected' as const,
      alreadyReviewed: false,
      refundedAmountCents: 0,
      sellerClawbackCents: 0,
      buyerBalanceAfter: null,
      purchaseId: request.purchaseId,
      skillName: null,
      buyerUserId: request.buyerUserId,
    }
  })
}

/**
 * 结算聚合原始值（全部为分/笔数）。抽成纯函数便于单测，
 * 也避免在 SQL 侧重复计算 authorNet/platformNet 两套口径。
 */
export interface SkillSettlementAggregate {
  paidCount: number
  refundedCount: number
  grossSalesCents: number
  refundedGrossCents: number
  authorShareEarnedCents: number
  authorShareOnRefundedCents: number
  sellerClawbackCents: number
  platformShareEarnedCents: number
  platformShareOnRefundedCents: number
  clawbackMissingCount: number
}

/** 按购买账本口径计算结算净额；平台承担 = 应冲正作者分成 - 实际扣回。 */
export function computeSkillSettlementTotals(
  raw: SkillSettlementAggregate,
): SkillMarketSettlementTotals {
  const authorShareActiveCents = raw.authorShareEarnedCents - raw.authorShareOnRefundedCents
  const platformShareActiveCents = raw.platformShareEarnedCents - raw.platformShareOnRefundedCents
  const platformBorneCents = raw.authorShareOnRefundedCents - raw.sellerClawbackCents
  return {
    paidCount: raw.paidCount,
    refundedCount: raw.refundedCount,
    grossSalesCents: raw.grossSalesCents,
    refundedGrossCents: raw.refundedGrossCents,
    netGmvCents: raw.grossSalesCents - raw.refundedGrossCents,
    authorShareEarnedCents: raw.authorShareEarnedCents,
    authorShareActiveCents,
    authorShareOnRefundedCents: raw.authorShareOnRefundedCents,
    sellerClawbackCents: raw.sellerClawbackCents,
    platformBorneCents,
    // 作者实际留存 = 全部销售应得 - 真正退回的分成；余额不足未扣回的部分由平台承担。
    authorNetCents: raw.authorShareEarnedCents - raw.sellerClawbackCents,
    platformShareEarnedCents: raw.platformShareEarnedCents,
    platformShareActiveCents,
    platformShareOnRefundedCents: raw.platformShareOnRefundedCents,
    platformNetCents:
      raw.platformShareEarnedCents - raw.platformShareOnRefundedCents - platformBorneCents,
    clawbackMissingCount: raw.clawbackMissingCount,
  }
}

function settlementInt(value: unknown): number {
  const parsed = typeof value === 'bigint' ? Number(value) : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const SETTLEMENT_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/** 账期按 Asia/Shanghai 自然月切分，返回 UTC 时间边界（前端不要自行推算）。 */
export function getSettlementMonthBounds(month: string): { start: Date; end: Date } {
  const match = SETTLEMENT_MONTH_RE.exec(month)
  if (!match) throw new Error(`无效账期: ${month}`)
  const year = Number(match[1])
  const monthNo = Number(match[2])
  // UTC+8 的月初 00:00 = 前一日 UTC 16:00；Date.UTC 的 month 参数可跨年。
  const start = new Date(Date.UTC(year, monthNo - 1, 1) - 8 * 60 * 60 * 1000)
  const end = new Date(Date.UTC(year, monthNo, 1) - 8 * 60 * 60 * 1000)
  return { start, end }
}

export function resolveSettlementPeriod(month?: string): SkillMarketSettlementPeriod {
  if (!month) return { month: null, from: null, to: null }
  const { start, end } = getSettlementMonthBounds(month)
  return { month, from: start.toISOString(), to: end.toISOString() }
}

/**
 * 管理员结算汇总：按 技能 + 卖家 聚合购买账本。
 * 查询只做原始聚合，净额统一走 computeSkillSettlementTotals，保证列表与总额同口径。
 * month 归期口径 = 下单时间；退款沿用原购买行的下单月份，不按退款时间二次归期。
 */
export async function getSkillMarketSettlement(input?: {
  month?: string
}): Promise<SkillMarketSettlementResponse> {
  const period = resolveSettlementPeriod(input?.month)
  const monthScope = period.month
    ? and(
        gte(skillMarketPurchases.createdAt, new Date(period.from as string)),
        lt(skillMarketPurchases.createdAt, new Date(period.to as string)),
      )
    : undefined

  const rows = await db
    .select({
      skillName: skillMarketPurchases.skillName,
      sellerUserId: skillMarketPurchases.sellerUserId,
      sellerNickname: sellerUser.nickname,
      paidCount: sql<number>`COUNT(*) FILTER (WHERE ${skillMarketPurchases.status} = 'paid')::int`,
      refundedCount: sql<number>`COUNT(*) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded')::int`,
      grossSalesCents: sql<string>`COALESCE(SUM(${skillMarketPurchases.priceCents}) FILTER (WHERE ${skillMarketPurchases.status} IN ('paid', 'refunded')), 0)::bigint`,
      refundedGrossCents: sql<string>`COALESCE(SUM(${skillMarketPurchases.refundAmountCents}) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded'), 0)::bigint`,
      authorShareEarnedCents: sql<string>`COALESCE(SUM(${skillMarketPurchases.authorShareCents}) FILTER (WHERE ${skillMarketPurchases.status} IN ('paid', 'refunded')), 0)::bigint`,
      authorShareOnRefundedCents: sql<string>`COALESCE(SUM(${skillMarketPurchases.authorShareCents}) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded'), 0)::bigint`,
      sellerClawbackCents: sql<string>`COALESCE(SUM(COALESCE(${skillMarketPurchases.sellerClawbackCents}, 0)) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded'), 0)::bigint`,
      platformShareEarnedCents: sql<string>`COALESCE(SUM(${skillMarketPurchases.platformShareCents}) FILTER (WHERE ${skillMarketPurchases.status} IN ('paid', 'refunded')), 0)::bigint`,
      platformShareOnRefundedCents: sql<string>`COALESCE(SUM(${skillMarketPurchases.platformShareCents}) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded'), 0)::bigint`,
      clawbackMissingCount: sql<number>`COUNT(*) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded' AND ${skillMarketPurchases.sellerClawbackCents} IS NULL)::int`,
    })
    .from(skillMarketPurchases)
    .leftJoin(sellerUser, eq(skillMarketPurchases.sellerUserId, sellerUser.id))
    .where(monthScope)
    .groupBy(skillMarketPurchases.skillName, skillMarketPurchases.sellerUserId, sellerUser.nickname)
    .orderBy(sql`COALESCE(SUM(${skillMarketPurchases.priceCents}), 0) DESC`)

  const items: SkillMarketSettlementRow[] = rows.map((row) => ({
    skillName: row.skillName,
    sellerUserId: row.sellerUserId,
    sellerNickname: row.sellerNickname,
    ...computeSkillSettlementTotals({
      paidCount: settlementInt(row.paidCount),
      refundedCount: settlementInt(row.refundedCount),
      grossSalesCents: settlementInt(row.grossSalesCents),
      refundedGrossCents: settlementInt(row.refundedGrossCents),
      authorShareEarnedCents: settlementInt(row.authorShareEarnedCents),
      authorShareOnRefundedCents: settlementInt(row.authorShareOnRefundedCents),
      sellerClawbackCents: settlementInt(row.sellerClawbackCents),
      platformShareEarnedCents: settlementInt(row.platformShareEarnedCents),
      platformShareOnRefundedCents: settlementInt(row.platformShareOnRefundedCents),
      clawbackMissingCount: settlementInt(row.clawbackMissingCount),
    }),
  }))

  const summary = items.reduce<SkillMarketSettlementTotals>(
    (acc, item) => {
      for (const key of Object.keys(acc) as Array<keyof SkillMarketSettlementTotals>) {
        acc[key] += item[key]
      }
      return acc
    },
    {
      paidCount: 0,
      refundedCount: 0,
      grossSalesCents: 0,
      refundedGrossCents: 0,
      netGmvCents: 0,
      authorShareEarnedCents: 0,
      authorShareActiveCents: 0,
      authorShareOnRefundedCents: 0,
      sellerClawbackCents: 0,
      platformBorneCents: 0,
      authorNetCents: 0,
      platformShareEarnedCents: 0,
      platformShareActiveCents: 0,
      platformShareOnRefundedCents: 0,
      platformNetCents: 0,
      clawbackMissingCount: 0,
    },
  )

  return { summary, items, currency: 'CNY', period }
}

/**
 * 管理员卖家账户对账：交易口径按账期从购买账本聚合，余额/佣金/提现是当前账户快照。
 *
 * 只读，不改任何账。`commissionGapCents` 是“有效技能佣金流水 - 有效作者分成”，
 * 正常应为 0；非 0 时说明佣金冲正或历史账本对不上，运营需要人工核查。
 */
export async function getSkillMarketSellerAccounts(input?: {
  month?: string
}): Promise<SkillSellerAccountsResponse> {
  const settlement = await getSkillMarketSettlement(input)
  const zeroTotals = (): SkillMarketSettlementTotals => ({
    paidCount: 0,
    refundedCount: 0,
    grossSalesCents: 0,
    refundedGrossCents: 0,
    netGmvCents: 0,
    authorShareEarnedCents: 0,
    authorShareActiveCents: 0,
    authorShareOnRefundedCents: 0,
    sellerClawbackCents: 0,
    platformBorneCents: 0,
    authorNetCents: 0,
    platformShareEarnedCents: 0,
    platformShareActiveCents: 0,
    platformShareOnRefundedCents: 0,
    platformNetCents: 0,
    clawbackMissingCount: 0,
  })

  const bySeller = new Map<
    string,
    { sellerNickname: string | null; totals: SkillMarketSettlementTotals }
  >()
  for (const row of settlement.items) {
    if (!row.sellerUserId) continue
    let entry = bySeller.get(row.sellerUserId)
    if (!entry) {
      entry = { sellerNickname: row.sellerNickname, totals: zeroTotals() }
      bySeller.set(row.sellerUserId, entry)
    }
    for (const key of Object.keys(entry.totals) as Array<keyof SkillMarketSettlementTotals>) {
      entry.totals[key] += row[key]
    }
  }

  const sellerIds = Array.from(bySeller.keys())
  if (sellerIds.length === 0) {
    return {
      items: [],
      summary: {
        sellers: 0,
        platformBorneCents: 0,
        walletBalanceCents: 0,
        withdrawableCents: 0,
        mismatchCount: 0,
      },
      currency: 'CNY',
      period: settlement.period,
    }
  }

  const [marginRows, commissionRows, withdrawalRows] = await Promise.all([
    db
      .select({ userId: userMargins.userId, tokenQuantity: userMargins.tokenQuantity })
      .from(userMargins)
      .where(inArray(userMargins.userId, sellerIds)),
    db
      .select({
        beneficiaryId: commissionFlows.beneficiaryId,
        type: commissionFlows.type,
        status: commissionFlows.status,
        total: sql<string>`COALESCE(SUM(${commissionFlows.amount}), 0)::bigint`,
      })
      .from(commissionFlows)
      .where(inArray(commissionFlows.beneficiaryId, sellerIds))
      .groupBy(commissionFlows.beneficiaryId, commissionFlows.type, commissionFlows.status),
    db
      .select({
        userId: withdrawalFlows.userId,
        status: withdrawalFlows.status,
        total: sql<string>`COALESCE(SUM(${withdrawalFlows.originalAmount}), 0)::bigint`,
      })
      .from(withdrawalFlows)
      .where(inArray(withdrawalFlows.userId, sellerIds))
      .groupBy(withdrawalFlows.userId, withdrawalFlows.status),
  ])

  const walletBySeller = new Map<string, number>()
  for (const row of marginRows) walletBySeller.set(row.userId, row.tokenQuantity)

  const commissionBySeller = new Map<
    string,
    { skillActive: number; skillInvalid: number; activeAll: number }
  >()
  for (const row of commissionRows) {
    if (!row.beneficiaryId) continue
    const current = commissionBySeller.get(row.beneficiaryId) ?? {
      skillActive: 0,
      skillInvalid: 0,
      activeAll: 0,
    }
    const amount = settlementInt(row.total)
    if (row.type === 3 && row.status === 1) current.skillActive += amount
    if (row.type === 3 && row.status === 0) current.skillInvalid += amount
    if (row.status === 1) current.activeAll += amount
    commissionBySeller.set(row.beneficiaryId, current)
  }

  const withdrawalBySeller = new Map<
    string,
    { occupied: number; pending: number; completed: number }
  >()
  for (const row of withdrawalRows) {
    if (!row.userId) continue
    const current = withdrawalBySeller.get(row.userId) ?? { occupied: 0, pending: 0, completed: 0 }
    const amount = settlementInt(row.total)
    if (row.status === 0 || row.status === 1) current.pending += amount
    if (row.status === 2) current.completed += amount
    if (row.status === 0 || row.status === 1 || row.status === 2) current.occupied += amount
    withdrawalBySeller.set(row.userId, current)
  }

  const items = sellerIds.map((sellerUserId) => {
    const entry = bySeller.get(sellerUserId)!
    const totals = entry.totals
    const commission = commissionBySeller.get(sellerUserId) ?? {
      skillActive: 0,
      skillInvalid: 0,
      activeAll: 0,
    }
    const withdrawal = withdrawalBySeller.get(sellerUserId) ?? {
      occupied: 0,
      pending: 0,
      completed: 0,
    }
    const walletBalanceCents = walletBySeller.get(sellerUserId) ?? 0
    const commissionGapCents = commission.skillActive - totals.authorShareActiveCents
    const withdrawableCents = Math.max(0, commission.activeAll - withdrawal.occupied)
    const flags: SkillSellerAccountFlag[] = []
    if (totals.platformBorneCents > 0) flags.push('platform_borne')
    if (totals.clawbackMissingCount > 0) flags.push('clawback_missing')
    if (walletBalanceCents < 0) flags.push('negative_wallet')
    if (commissionGapCents !== 0) flags.push('commission_mismatch')

    return {
      sellerUserId,
      sellerNickname: entry.sellerNickname,
      ...totals,
      skillActiveCommissionCents: commission.skillActive,
      skillInvalidCommissionCents: commission.skillInvalid,
      activeCommissionCents: commission.activeAll,
      walletBalanceCents,
      withdrawalOccupiedCents: withdrawal.occupied,
      pendingWithdrawalCents: withdrawal.pending,
      completedWithdrawalCents: withdrawal.completed,
      withdrawableCents,
      commissionGapCents,
      flags,
    }
  })

  // 平台已承担越多越靠前；同额按成交额倒序，运营先处理最需要追偿/核查的卖家。
  items.sort(
    (a, b) =>
      b.platformBorneCents - a.platformBorneCents ||
      b.grossSalesCents - a.grossSalesCents ||
      a.sellerUserId.localeCompare(b.sellerUserId),
  )

  return {
    items,
    summary: {
      sellers: items.length,
      platformBorneCents: items.reduce((sum, item) => sum + item.platformBorneCents, 0),
      walletBalanceCents: items.reduce((sum, item) => sum + item.walletBalanceCents, 0),
      withdrawableCents: items.reduce((sum, item) => sum + item.withdrawableCents, 0),
      mismatchCount: items.filter((item) => item.commissionGapCents !== 0).length,
    },
    currency: 'CNY',
    period: settlement.period,
  }
}

export class SkillPurchaseStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillPurchaseStateError'
  }
}

export interface RefundSkillPurchaseResult {
  alreadyRefunded: boolean
  purchaseId: string
  skillName: string
  buyerUserId: string
  refundedAmountCents: number
  sellerClawbackCents: number
  buyerBalanceAfter: number | null
}

/**
 * 管理员退款：买家全额退回，卖家已分成尽量扣回（余额不足扣到 0，平台承担差额），
 * 同时把作者分成对应的可提现佣金置为失效。整个过程在一个事务里，购买行 FOR UPDATE
 * 串行化并发退款；退款后 status=refunded，部分唯一索引释放，可再次购买。
 */
export async function refundSkillPurchase(input: {
  purchaseId: string
  reason?: string
  operatorId: string | null
}): Promise<RefundSkillPurchaseResult> {
  return db.transaction((tx) => refundSkillPurchaseTx(tx, input))
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** 退款事务本体：允许退款申请审核在同一个事务里同时改申请状态。 */
async function refundSkillPurchaseTx(
  tx: DbTransaction,
  input: {
    purchaseId: string
    reason?: string
    operatorId: string | null
  },
): Promise<RefundSkillPurchaseResult> {
  const [purchase] = await tx
    .select()
    .from(skillMarketPurchases)
    .where(eq(skillMarketPurchases.id, input.purchaseId))
    .for('update')

  if (!purchase) throw new SkillPurchaseNotFoundError()

  if (purchase.status === 'refunded') {
    return {
      alreadyRefunded: true,
      purchaseId: purchase.id,
      skillName: purchase.skillName,
      buyerUserId: purchase.buyerUserId,
      refundedAmountCents: purchase.refundAmountCents,
      sellerClawbackCents: purchase.sellerClawbackCents ?? 0,
      buyerBalanceAfter: null,
    }
  }
  if (purchase.status !== 'paid') {
    throw new SkillPurchaseStateError(`不支持退款的购买状态: ${purchase.status}`)
  }

  const priceCents = purchase.priceCents
  // 买家全额退回：即使 margin 行不存在也补建，保证退款不会因账号没余额行而失败。
  const [buyer] = await tx
    .insert(userMargins)
    .values({ userId: purchase.buyerUserId, tokenQuantity: priceCents, frozenQuantity: 0 })
    .onConflictDoUpdate({
      target: userMargins.userId,
      set: {
        tokenQuantity: sql`${userMargins.tokenQuantity} + ${priceCents}`,
        updatedAt: new Date(),
      },
    })
    .returning({ tokenQuantity: userMargins.tokenQuantity })

  await tx.insert(tokenFlows).values({
    userId: purchase.buyerUserId,
    opType: 0,
    quantity: priceCents,
    balanceAfter: buyer?.tokenQuantity ?? priceCents,
    remark: `skill_market_refund:${purchase.skillName}`.slice(0, 255),
    relatedOrderNo: `skillrefund:${purchase.id}`,
  })

  let sellerClawbackCents = 0
  if (purchase.sellerUserId && purchase.authorShareCents > 0) {
    const [seller] = await tx
      .select({ tokenQuantity: userMargins.tokenQuantity })
      .from(userMargins)
      .where(eq(userMargins.userId, purchase.sellerUserId))
      .for('update')

    const before = seller?.tokenQuantity ?? 0
    sellerClawbackCents = Math.min(before, purchase.authorShareCents)
    let sellerBalanceAfter = before
    if (sellerClawbackCents > 0) {
      const [updated] = await tx
        .update(userMargins)
        .set({
          tokenQuantity: before - sellerClawbackCents,
          updatedAt: new Date(),
        })
        .where(eq(userMargins.userId, purchase.sellerUserId))
        .returning({ tokenQuantity: userMargins.tokenQuantity })
      sellerBalanceAfter = updated?.tokenQuantity ?? before - sellerClawbackCents

      await tx.insert(tokenFlows).values({
        userId: purchase.sellerUserId,
        opType: 3,
        quantity: sellerClawbackCents,
        balanceAfter: sellerBalanceAfter,
        remark: `skill_market_refund_clawback:${purchase.skillName}`.slice(0, 255),
        relatedOrderNo: `skillrefund:${purchase.id}:seller`,
      })
    }

    // 购买时写入的佣金记录优先按 purchase 上的 commission_flow_id 精确冲正；
    // 早期没有该列的历史行回退到 remark 匹配，防止作者继续提现已退回的分成。
    const commissionWhere = purchase.commissionFlowId
      ? eq(commissionFlows.id, purchase.commissionFlowId)
      : and(
          eq(commissionFlows.beneficiaryId, purchase.sellerUserId),
          eq(
            commissionFlows.remark,
            `skill_market_author_share:${purchase.id}:${purchase.skillName}`.slice(0, 255),
          ),
        )
    await tx
      .update(commissionFlows)
      .set({ status: 0, updatedAt: new Date(), updatedBy: input.operatorId })
      .where(commissionWhere)
  }

  await tx
    .update(skillMarketPurchases)
    .set({
      status: 'refunded',
      refundedAt: new Date(),
      refundAmountCents: priceCents,
      sellerClawbackCents,
      refundReason: input.reason?.slice(0, 255),
      refundedBy: input.operatorId,
    })
    .where(eq(skillMarketPurchases.id, purchase.id))

  return {
    alreadyRefunded: false,
    purchaseId: purchase.id,
    skillName: purchase.skillName,
    buyerUserId: purchase.buyerUserId,
    refundedAmountCents: priceCents,
    sellerClawbackCents,
    buyerBalanceAfter: buyer?.tokenQuantity ?? priceCents,
  }
}

interface EarningsSummaryRow {
  total: string | number
  sellerClawback: string | number
  paidCount: string | number
  refundedCount: string | number
  lastEarnedAt: Date | string | null
}

/**
 * 作者收益汇总 + 最近 50 笔流水。金额单位为分，直接来自购买账本。
 *
 * 净值口径 = 全部销售作者分成毛额 - 退款实际扣回；退款笔数单独展示，
 * 退款后不再把整笔销售从收益里抹掉，避免“卖过又退了”在作者端无记录。
 * 不返回买家 ID/昵称：作者只需要看到成交与退款，不需要买家身份。
 */
export async function getSkillEarnings(sellerUserId: string): Promise<SkillEarningsResponse> {
  const [summary] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${skillMarketPurchases.authorShareCents}), 0)`,
      sellerClawback: sql<string>`COALESCE(SUM(COALESCE(${skillMarketPurchases.sellerClawbackCents}, 0)) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded'), 0)`,
      paidCount: sql<number>`COUNT(*) FILTER (WHERE ${skillMarketPurchases.status} = 'paid')::int`,
      refundedCount: sql<number>`COUNT(*) FILTER (WHERE ${skillMarketPurchases.status} = 'refunded')::int`,
      lastEarnedAt: sql<Date | string | null>`MAX(${skillMarketPurchases.createdAt})`,
    })
    .from(skillMarketPurchases)
    .where(eq(skillMarketPurchases.sellerUserId, sellerUserId))
    .limit(1)

  const rows = await db
    .select({
      id: skillMarketPurchases.id,
      skillName: skillMarketPurchases.skillName,
      priceCents: skillMarketPurchases.priceCents,
      authorShareCents: skillMarketPurchases.authorShareCents,
      sellerClawbackCents: skillMarketPurchases.sellerClawbackCents,
      revenueShareBps: skillMarketPurchases.revenueShareBps,
      status: skillMarketPurchases.status,
      createdAt: skillMarketPurchases.createdAt,
      refundedAt: skillMarketPurchases.refundedAt,
    })
    .from(skillMarketPurchases)
    .where(eq(skillMarketPurchases.sellerUserId, sellerUserId))
    .orderBy(desc(skillMarketPurchases.createdAt))
    .limit(50)

  const row = summary as EarningsSummaryRow | undefined
  const totalAuthorShareCents = Number(row?.total ?? 0)
  const sellerClawbackCents = Number(row?.sellerClawback ?? 0)
  return {
    totalAuthorShareCents,
    sellerClawbackCents,
    netAuthorShareCents: totalAuthorShareCents - sellerClawbackCents,
    paidCount: Number(row?.paidCount ?? 0),
    refundedCount: Number(row?.refundedCount ?? 0),
    currency: 'CNY',
    lastEarnedAt: row?.lastEarnedAt ? new Date(row.lastEarnedAt).toISOString() : null,
    items: rows.map((item) => ({
      ...item,
      status: item.status as 'paid' | 'refunded',
      netAuthorShareCents: item.authorShareCents - (item.sellerClawbackCents ?? 0),
      createdAt: new Date(item.createdAt).toISOString(),
      refundedAt: item.refundedAt ? new Date(item.refundedAt).toISOString() : null,
    })),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
