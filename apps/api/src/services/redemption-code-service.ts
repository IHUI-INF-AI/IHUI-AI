/**
 * 兑换码核心 service(P0-5 刮刮卡式裂变充值,2026-07-31 立)。
 *
 * 职责:
 * 1. batchGenerateCodes: admin 批量生成兑换码(面值 + token 数 + 过期时间)
 * 2. redeemCode: 用户输入兑换码 → 余额到账(幂等 + 状态翻转 unused → used)
 * 3. listCodes: admin 列表查询(可筛选 status/batchId)
 * 4. disableCode: admin 禁用兑换码(unused ↔ disabled)
 *
 * 幂等实现:用 UPDATE WHERE status='unused' RETURNING 原子翻转状态,
 * 同一 code 多次兑换只有第一次 RETURNING 到行,后续均返回 0 行 → 幂等拒绝。
 *
 * 码生成规则:IHUI-XXXX-XXXX-XXXX(16 位,去除易混淆字符 O/0/I/1/L)。
 */
import { randomBytes, randomUUID } from 'crypto'
import { eq, and, sql, desc, ne, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { redemptionCodes, developerApiKeys } from '@ihui/database'
import type { RedemptionCode } from '@ihui/database'

// =============================================================================
// 常量
// =============================================================================

/** 兑换码字符集(去除易混淆字符 O/0/I/1/L,共 31 个字符) */
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** 单次批量生成上限 */
const MAX_BATCH_COUNT = 1000

/** 码段长度(IHUI-XXXX-XXXX-XXXX,后 3 段每段 4 字符) */
const CODE_SEGMENT_LENGTH = 4

/** 码段数(前缀 IHUI + 3 段随机字符) */
const CODE_RANDOM_SEGMENTS = 3

// =============================================================================
// 1. batchGenerateCodes — 批量生成兑换码
// =============================================================================

/**
 * 生成单个兑换码:IHUI-XXXX-XXXX-XXXX。
 * X 从 CODE_CHARSET(31 字符,去除易混淆字符)中随机选取。
 */
function generateSingleCode(): string {
  const segments: string[] = []
  for (let i = 0; i < CODE_RANDOM_SEGMENTS; i++) {
    const bytes = randomBytes(CODE_SEGMENT_LENGTH)
    let seg = ''
    for (let j = 0; j < CODE_SEGMENT_LENGTH; j++) {
      // noUncheckedIndexedAccess: bytes[j] 返回 number | undefined,用 ?? 0 兜底(Buffer 长度恒等于 CODE_SEGMENT_LENGTH,不会触发)
      // charAt 对越界索引返回空串,避免 indexed access 的 string | undefined 问题
      const byte = bytes[j] ?? 0
      seg += CODE_CHARSET.charAt(byte % CODE_CHARSET.length)
    }
    segments.push(seg)
  }
  return `IHUI-${segments.join('-')}`
}

/**
 * 规范化兑换码:去首尾空格 + 转大写 + 去内部空格。
 * 用户输入 "ihui-abcd-efgh-jklm " → "IHUI-ABCD-EFGH-JKLM"
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export interface BatchGenerateInput {
  count: number
  faceValueCents: number
  tokenAmount: number
  expiresAt?: Date | null
  createdBy: string
}

/**
 * 批量生成兑换码。
 *
 * - count: 生成数量(1-1000,超出拒绝)
 * - faceValueCents: 面值(分,如 990 = ¥9.90)
 * - tokenAmount: 兑换后到账 token 数
 * - expiresAt: 过期时间(可选,null = 永不过期)
 * - createdBy: 创建者 admin user_id
 *
 * 返回生成的码列表(含完整 DB 行)。
 */
export async function batchGenerateCodes(
  input: BatchGenerateInput,
): Promise<RedemptionCode[]> {
  const { count, faceValueCents, tokenAmount, expiresAt, createdBy } = input

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count 必须是大于 0 的整数')
  }
  if (count > MAX_BATCH_COUNT) {
    throw new Error(`count 不能超过 ${MAX_BATCH_COUNT}`)
  }
  if (!Number.isInteger(faceValueCents) || faceValueCents < 0) {
    throw new Error('faceValueCents 必须是非负整数')
  }
  if (!Number.isInteger(tokenAmount) || tokenAmount <= 0) {
    throw new Error('tokenAmount 必须是大于 0 的整数')
  }

  const batchId = randomUUID()

  // 生成 count 个不重复的码(用 Set 去重,极低概率碰撞时自动补齐)
  const codeSet = new Set<string>()
  while (codeSet.size < count) {
    codeSet.add(generateSingleCode())
  }

  const rows = Array.from(codeSet).map((code) => ({
    code,
    batchId,
    faceValueCents,
    tokenAmount,
    status: 'unused' as const,
    createdBy,
    expiresAt: expiresAt ?? null,
  }))

  const inserted = await db
    .insert(redemptionCodes)
    .values(rows)
    .returning()

  return inserted
}

// =============================================================================
// 2. redeemCode — 兑换码兑换(幂等)
// =============================================================================

export interface RedeemResult {
  success: boolean
  tokenAmount?: number
  newTokenBalance?: number
  reason?: string
}

/**
 * 兑换码兑换(幂等 + 事务回滚)。
 *
 * - code: 兑换码(自动 normalize 去空格/转大写)
 * - userId: 兑换用户
 * - apiKeyId: 可选,指定充值到哪个 Key;未传则用用户最新 active Key
 *
 * 幂等:用 UPDATE WHERE status='unused' AND (expires_at IS NULL OR expires_at > now())
 * RETURNING * 原子翻转状态。同一 code 多次兑换只有第一次 RETURNING 到行。
 *
 * 事务原子性(P0 修复 2026-08-02):标记 used + 查 active Key + 充值 三步全部包在
 * db.transaction 内。任一步失败(无 active Key / Key 不存在 / 充值 0 行)→ throw 触发
 * 整事务回滚,码状态保持 unused,价值不丢失。原实现标记 used 后才充值,充值失败码已
 * 消费但余额未到账(价值丢失)。
 *
 * 充值逻辑:内联 rechargeByKey 的 CASE WHEN(tokenBalance=-1 保持 -1,否则累加),
 * 用 tx 而非全局 db,确保随事务回滚。
 */
export async function redeemCode(
  code: string,
  userId: string,
  apiKeyId?: string,
): Promise<RedeemResult> {
  const normalized = normalizeCode(code)

  // 事务内错误标记:throw 触发回滚,外层 catch 转换为 RedeemResult
  const ERR_NO_ACTIVE_KEY = 'REDEEM_NO_ACTIVE_KEY'
  const ERR_KEY_RECHARGE_FAILED = 'REDEEM_KEY_RECHARGE_FAILED'

  // 保存抢占到的 tokenAmount,供 catch 分支返回(事务回滚后 claimed 出作用域)
  let claimedTokenAmount: number | undefined

  try {
    return await db.transaction(async (tx) => {
      // 1. 原子翻转状态:unused → used(同时校验未过期)
      //    RETURNING 到行 = 抢占成功;0 行 = 码不存在/已用/已过期/已禁用
      const [claimed] = await tx
        .update(redemptionCodes)
        .set({
          status: 'used',
          usedBy: userId,
          usedAt: new Date(),
        })
        .where(
          and(
            eq(redemptionCodes.code, normalized),
            eq(redemptionCodes.status, 'unused'),
            sql`(${redemptionCodes.expiresAt} IS NULL OR ${redemptionCodes.expiresAt} > now())`,
          ),
        )
        .returning()

      if (!claimed) {
        // 2. 抢占失败,查询真实原因(给用户准确反馈)— 只读诊断,无需纳入事务写
        const [existing] = await dbRead
          .select({
            status: redemptionCodes.status,
            expiresAt: redemptionCodes.expiresAt,
          })
          .from(redemptionCodes)
          .where(eq(redemptionCodes.code, normalized))
          .limit(1)

        if (!existing) {
          return { success: false, reason: 'code_not_found' }
        }
        if (existing.status === 'used') {
          return { success: false, reason: 'already_used' }
        }
        if (existing.status === 'disabled') {
          return { success: false, reason: 'disabled' }
        }
        if (existing.status === 'expired' || (existing.expiresAt && existing.expiresAt < new Date())) {
          return { success: false, reason: 'expired' }
        }
        return { success: false, reason: 'not_unused' }
      }

      // 抢占成功,记录 tokenAmount 供 catch 分支使用
      claimedTokenAmount = claimed.tokenAmount

      // 3. 确定目标 Key(事务内查,保证与后续充值同快照)
      let targetKeyId = apiKeyId
      if (!targetKeyId) {
        const [activeKey] = await tx
          .select({ id: developerApiKeys.id })
          .from(developerApiKeys)
          .where(
            and(
              eq(developerApiKeys.userId, userId),
              eq(developerApiKeys.status, 'active'),
            ),
          )
          .orderBy(desc(developerApiKeys.createdAt))
          .limit(1)

        if (!activeKey) {
          // 没有 active Key,抛错触发事务回滚(码保持 unused,价值不丢失)
          throw new Error(ERR_NO_ACTIVE_KEY)
        }
        targetKeyId = activeKey.id
      }

      // 4. 原子充值(事务内,内联 rechargeByKey 核心 CASE WHEN 逻辑以纳入回滚)
      //    rechargeByKey 用全局 db 无法随事务回滚,这里用 tx 重放:
      //    tokenBalance = -1(无限额度)保持 -1,否则累加 tokenAmount
      const [updated] = await tx
        .update(developerApiKeys)
        .set({
          tokenBalance: sql`CASE WHEN ${developerApiKeys.tokenBalance} = -1 THEN -1 ELSE ${developerApiKeys.tokenBalance} + ${claimed.tokenAmount} END`,
          updatedAt: new Date(),
        })
        .where(eq(developerApiKeys.id, targetKeyId))
        .returning({ tokenBalance: developerApiKeys.tokenBalance })

      if (!updated) {
        // Key 不存在(提供的 apiKeyId 无效,或并发删除),抛错触发事务回滚
        throw new Error(ERR_KEY_RECHARGE_FAILED)
      }

      return {
        success: true,
        tokenAmount: claimed.tokenAmount,
        newTokenBalance: updated.tokenBalance,
      }
    })
  } catch (err) {
    if (err instanceof Error && err.message === ERR_NO_ACTIVE_KEY) {
      // 事务已回滚,码保持 unused;tokenAmount 仅作提示
      return {
        success: false,
        tokenAmount: claimedTokenAmount,
        reason: 'no_active_key',
      }
    }
    if (err instanceof Error && err.message === ERR_KEY_RECHARGE_FAILED) {
      // 事务已回滚,码保持 unused
      return {
        success: false,
        tokenAmount: claimedTokenAmount,
        reason: 'key_not_found',
      }
    }
    // 其他异常(连接失败/死锁等)重新抛出,由上层统一错误处理
    throw err
  }
}

// =============================================================================
// 3. listCodes — 列表查询(admin)
// =============================================================================

export interface ListCodesFilter {
  status?: string
  batchId?: string
  page?: number
  pageSize?: number
}

export interface ListCodesResult {
  items: RedemptionCode[]
  total: number
}

/**
 * 列出兑换码(admin 用,可筛选 status/batchId,分页)。
 */
export async function listCodes(filter: ListCodesFilter): Promise<ListCodesResult> {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))

  const conds: SQL[] = []
  if (filter.status) {
    conds.push(eq(redemptionCodes.status, filter.status))
  }
  if (filter.batchId) {
    conds.push(eq(redemptionCodes.batchId, filter.batchId))
  }
  const where = conds.length > 0 ? and(...conds) : undefined

  const [items, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(redemptionCodes)
      .where(where)
      .orderBy(desc(redemptionCodes.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(redemptionCodes)
      .where(where),
  ])

  return { items, total: totalRows[0]?.c ?? 0 }
}

// =============================================================================
// 4. disableCode — 禁用兑换码(admin)
// =============================================================================

/**
 * 禁用兑换码(admin 用,unused → disabled)。
 * 已 used 的码不可禁用(已消费,禁用无意义)。
 */
export async function disableCode(id: string): Promise<RedemptionCode> {
  // 先查状态,已 used 的拒绝
  const [existing] = await dbRead
    .select({ status: redemptionCodes.status })
    .from(redemptionCodes)
    .where(eq(redemptionCodes.id, id))
    .limit(1)

  if (!existing) {
    throw new Error('code_not_found')
  }
  if (existing.status === 'used') {
    throw new Error('cannot_disable_used')
  }

  const [updated] = await db
    .update(redemptionCodes)
    .set({ status: 'disabled' })
    .where(
      and(
        eq(redemptionCodes.id, id),
        ne(redemptionCodes.status, 'used'),
      ),
    )
    .returning()

  if (!updated) {
    throw new Error('update_failed')
  }
  return updated
}

// =============================================================================
// 5. getStats — 统计(admin)
// =============================================================================

export interface CodesStats {
  total: number
  unused: number
  used: number
  expired: number
  disabled: number
  totalFaceValueCents: number
  totalTokenAmount: number
}

/**
 * 兑换码统计:各状态计数 + 总面值 + 总 token 数。
 */
export async function getStats(): Promise<CodesStats> {
  const rows = await dbRead
    .select({
      status: redemptionCodes.status,
      count: sql<number>`count(*)::int`,
      faceValueSum: sql<number>`coalesce(sum(${redemptionCodes.faceValueCents}), 0)::int`,
      tokenSum: sql<number>`coalesce(sum(${redemptionCodes.tokenAmount}), 0)::bigint::int`,
    })
    .from(redemptionCodes)
    .groupBy(redemptionCodes.status)

  const stats: CodesStats = {
    total: 0,
    unused: 0,
    used: 0,
    expired: 0,
    disabled: 0,
    totalFaceValueCents: 0,
    totalTokenAmount: 0,
  }

  for (const row of rows) {
    stats.total += row.count
    if (row.status === 'unused') stats.unused += row.count
    else if (row.status === 'used') stats.used += row.count
    else if (row.status === 'expired') stats.expired += row.count
    else if (row.status === 'disabled') stats.disabled += row.count
    stats.totalFaceValueCents += row.faceValueSum
    stats.totalTokenAmount += row.tokenSum
  }

  return stats
}
