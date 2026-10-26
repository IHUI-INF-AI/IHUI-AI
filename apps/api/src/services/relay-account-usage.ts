// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池用量台账服务(2026-10-22 立,反代号池子系统数据层)。
 *
 * 职责:
 * 1. recordAccountUsage — 每次转发调用(成功/失败)向 ai_relay_account_usage_ledger 落一行。
 *    **fire-and-forget**:内部吞掉一切异常只记 warn,永不抛(台账失败绝不影响转发主链路)。
 * 2. getAccountUsageSummaries — 批量按 accountId 聚合近 24h calls/tokens/failRate(admin list 富化用)。
 * 3. getAccountUsage — 单账号按 days 窗口的 24h 汇总 + 分页明细 + 明细总数(admin usage 端点用)。
 * 4. purgeAccountUsage — 清理早于保留期的台账行(调度每轮 sweep 触发,24h 节流)。
 *
 * 表定义 packages/database/src/schema/ai-relay.ts aiRelayAccountUsageLedger(迁移 329)。
 */
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { aiRelayAccountUsageLedger, type AiRelayAccountUsageLedger } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { logger } from '../utils/logger.js'

const DAY_MS = 24 * 60 * 60 * 1000

export interface RecordAccountUsageInput {
  accountId: string
  providerCode: string
  model: string
  promptTokens: number
  completionTokens: number
  /** 推理 token(completion 已含它,只作拆分展示);缺省 0 */
  reasoningTokens?: number
  /** 命中缓存的前缀 token;缺省 0 */
  cachedTokens?: number
  ok: boolean
  latencyMs: number
  ts?: Date
}

/**
 * 落一行用量台账。**永不抛**(内部全量吞异常只记 warn),调用方可安全 await 或即发即忘。
 */
/**
 * latency_ms 是 integer 列,而转发层给的是浮点耗时(如 761.6792)——
 * 直接写会让 PostgreSQL 整行拒收,台账静默丢空。落库前统一归一为整数毫秒。
 */
function normalizeLedgerLatencyMs(value: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

export async function recordAccountUsage(input: RecordAccountUsageInput): Promise<void> {
  try {
    await db.insert(aiRelayAccountUsageLedger).values({
      accountId: input.accountId,
      providerCode: input.providerCode,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      reasoningTokens: input.reasoningTokens ?? 0,
      cachedTokens: input.cachedTokens ?? 0,
      ok: input.ok,
      latencyMs: normalizeLedgerLatencyMs(input.latencyMs),
      ts: input.ts ?? new Date(),
    })
  } catch (e) {
    logger.warn('[relay-account-usage] 用量台账写入失败(已吞,不影响转发)', {
      accountId: input.accountId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export interface AccountUsageSummary {
  calls24h: number
  tokens24h: number
  failRate24h: number
}

const EMPTY_SUMMARY: AccountUsageSummary = { calls24h: 0, tokens24h: 0, failRate24h: 0 }

/**
 * 批量取多账号近 24h 用量汇总(list 富化用)。查询失败返回空 Map,永不抛。
 */
export async function getAccountUsageSummaries(
  accountIds: string[],
): Promise<Map<string, AccountUsageSummary>> {
  const out = new Map<string, AccountUsageSummary>()
  if (accountIds.length === 0) return out
  const since = new Date(Date.now() - DAY_MS)
  try {
    const rows = await dbRead
      .select({
        accountId: aiRelayAccountUsageLedger.accountId,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${aiRelayAccountUsageLedger.promptTokens} + ${aiRelayAccountUsageLedger.completionTokens}), 0)::int`,
        fails: sql<number>`coalesce(sum(case when ${aiRelayAccountUsageLedger.ok} then 0 else 1 end), 0)::int`,
      })
      .from(aiRelayAccountUsageLedger)
      .where(
        and(
          inArray(aiRelayAccountUsageLedger.accountId, accountIds),
          gte(aiRelayAccountUsageLedger.ts, since),
        ),
      )
      .groupBy(aiRelayAccountUsageLedger.accountId)
    for (const r of rows) {
      out.set(r.accountId, {
        calls24h: r.calls,
        tokens24h: r.tokens,
        failRate24h: r.calls > 0 ? Math.round((r.fails / r.calls) * 10000) / 10000 : 0,
      })
    }
  } catch (e) {
    logger.warn('[relay-account-usage] 24h 用量聚合失败(降级为空汇总)', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
  return out
}

export interface AccountUsageResult {
  accountId: string
  days: number
  /** 近 24h 汇总(calls/tokens/failRate) */
  summary: AccountUsageSummary
  /** days 窗口内明细(ts 倒序,分页;默认 500 条,上限 1000) */
  detail: AiRelayAccountUsageLedger[]
  /** days 窗口内明细总条数(不受 limit/offset 影响) */
  detailTotal: number
}

export interface AccountUsageQueryOptions {
  limit?: number
  offset?: number
}

const DETAIL_LIMIT_DEFAULT = 500
const DETAIL_LIMIT_MAX = 1000

function normalizeLimit(v: number | undefined): number {
  if (v === undefined || !Number.isFinite(v)) return DETAIL_LIMIT_DEFAULT
  return Math.min(Math.max(Math.trunc(v), 1), DETAIL_LIMIT_MAX)
}

function normalizeOffset(v: number | undefined): number {
  if (v === undefined || !Number.isFinite(v)) return 0
  return Math.max(Math.trunc(v), 0)
}

/**
 * 单账号按 days 窗口的用量:24h 汇总 + 分页明细 + 明细总数。
 * 任一查询失败均降级(空值/空明细/0),永不抛。
 */
export async function getAccountUsage(
  accountId: string,
  days = 7,
  opts: AccountUsageQueryOptions = {},
): Promise<AccountUsageResult> {
  const summary = (await getAccountUsageSummaries([accountId])).get(accountId) ?? {
    ...EMPTY_SUMMARY,
  }
  const limit = normalizeLimit(opts.limit)
  const offset = normalizeOffset(opts.offset)
  let detail: AiRelayAccountUsageLedger[] = []
  let detailTotal = 0
  try {
    const since = new Date(Date.now() - days * DAY_MS)
    const where = and(
      eq(aiRelayAccountUsageLedger.accountId, accountId),
      gte(aiRelayAccountUsageLedger.ts, since),
    )
    detail = await dbRead
      .select()
      .from(aiRelayAccountUsageLedger)
      .where(where)
      .orderBy(sql`${aiRelayAccountUsageLedger.ts} desc`)
      .limit(limit)
      .offset(offset)
    const totalRows = await dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(aiRelayAccountUsageLedger)
      .where(where)
    detailTotal = totalRows[0]?.c ?? 0
  } catch (e) {
    logger.warn('[relay-account-usage] 用量明细查询失败(降级为空明细)', {
      accountId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
  return { accountId, days, summary, detail, detailTotal }
}

/** 台账保留天数默认值;可用 RELAY_ACCOUNT_USAGE_KEEP_DAYS 覆盖。 */
const KEEP_DAYS_DEFAULT = 30
const KEEP_DAYS = (() => {
  const raw = Number(process.env.RELAY_ACCOUNT_USAGE_KEEP_DAYS)
  return Number.isFinite(raw) && raw > 0 ? raw : KEEP_DAYS_DEFAULT
})()

/**
 * 清理早于保留期的台账行,返回删除行数。**永不抛**(失败返回 0)。
 * 由调度每轮 sweep 调用(调度侧做 24h 节流),避免台账无限膨胀。
 */
export async function purgeAccountUsage(beforeDays = KEEP_DAYS): Promise<number> {
  try {
    const days = Number.isFinite(beforeDays) && beforeDays > 0 ? beforeDays : KEEP_DAYS_DEFAULT
    const cutoff = new Date(Date.now() - days * DAY_MS)
    const deleted = await db
      .delete(aiRelayAccountUsageLedger)
      .where(lt(aiRelayAccountUsageLedger.ts, cutoff))
      .returning({ id: aiRelayAccountUsageLedger.id })
    return deleted.length
  } catch (e) {
    logger.warn('[relay-account-usage] 台账过期清理失败(已吞)', {
      error: e instanceof Error ? e.message : String(e),
    })
    return 0
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
