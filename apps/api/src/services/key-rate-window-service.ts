// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Key 级限流窗口服务(2026-09-16 立,深度对标补强 B)。
 *
 * 三个滚动/固定窗口的"每窗口最大请求数"上限:
 * - 5h  → epoch 固定对齐窗口(floor(epoch/5h)*5h),对齐订阅上游滚动窗口形态
 * - 1d  → UTC+8 自然日(与订阅窗口/阶梯计价口径一致)
 * - 7d  → UTC+8 周一~周日
 *
 * 限额语义:developer_api_keys.rate_limit_5h/1d/7d,NULL = 不限;>0 = 窗口内最大请求数。
 * 计数:key_rate_window_counts 表 UPSERT(唯一索引 key×type×windowStart)。
 * 校验在 checkQuota(每次调用必经),计数在 recordCall 成功路径 fire-and-forget。
 *
 * 兼容:三列全 NULL 的 Key(存量全部)零开销——直接跳过任何窗口查询/写入。
 */
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys, keyRateWindowCounts } from '@ihui/database'
import { getUtc8DayStart, getUtc8WeekStart } from './subscription-window-service.js'

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000

export type KeyWindowType = '5h' | '1d' | '7d'

const ALL_KEY_WINDOWS: KeyWindowType[] = ['5h', '1d', '7d']

/** 窗口起点(半开区间 [start, start+len)):5h 固定对齐,1d/7d 用 UTC+8。 */
export function getKeyWindowStart(windowType: KeyWindowType, at: Date = new Date()): Date {
  if (windowType === '5h') {
    return new Date(Math.floor(at.getTime() / FIVE_HOURS_MS) * FIVE_HOURS_MS)
  }
  if (windowType === '1d') return getUtc8DayStart(at)
  return getUtc8WeekStart(at)
}

export interface KeyWindowLimits {
  '5h': number | null
  '1d': number | null
  '7d': number | null
}

/** 从 Key 行取三窗口限额(NULL = 不限)。 */
export function limitsOf(key: {
  rateLimit5h: number | null
  rateLimit1d: number | null
  rateLimit7d: number | null
}): KeyWindowLimits {
  return {
    '5h': key.rateLimit5h ?? null,
    '1d': key.rateLimit1d ?? null,
    '7d': key.rateLimit7d ?? null,
  }
}

export interface KeyWindowCheckResult {
  allowed: boolean
  blocked?: { windowType: KeyWindowType; limit: number; used: number; resetsAtMs: number }
  /** failMode='close' 且计数读源(DB 副本)异常时为 true(无法确认窗口用量,由调用方决定 503)。 */
  backendUnavailable?: boolean
}

/**
 * 校验 Key 的三窗口请求数(仅对配置了限额的窗口生效)。
 * - failMode='open'(默认,relay 计费路径历史行为):任何异常(表未迁移等)放行——
 *   窗口是附加约束,余额/熔断已兜底。
 * - failMode='close'(O2 2026-09-21,requireApiKeyAuth 主链路):异常不再静默放行,
 *   返回 backendUnavailable=true,由调用方按能力目录判据决定是否 503。
 */
export async function checkKeyRateWindows(
  apiKeyId: string,
  limits: KeyWindowLimits,
  at: Date = new Date(),
  failMode: 'open' | 'close' = 'open',
): Promise<KeyWindowCheckResult> {
  const configured = ALL_KEY_WINDOWS.filter((w) => (limits[w] ?? 0) > 0)
  if (configured.length === 0) return { allowed: true }
  try {
    const starts = configured.map((w) => ({ w, start: getKeyWindowStart(w, at) }))
    const rows = await dbRead
      .select({
        windowType: keyRateWindowCounts.windowType,
        windowStart: keyRateWindowCounts.windowStart,
        requestCount: keyRateWindowCounts.requestCount,
      })
      .from(keyRateWindowCounts)
      .where(
        and(
          eq(keyRateWindowCounts.keyId, apiKeyId),
          inArray(
            keyRateWindowCounts.windowStart,
            starts.map((s) => s.start),
          ),
        ),
      )
    const usedMap = new Map<KeyWindowType, number>()
    for (const r of rows) {
      const t = r.windowType as KeyWindowType
      const match = starts.find((s) => s.w === t && s.start.getTime() === r.windowStart.getTime())
      if (match) usedMap.set(t, Number(r.requestCount ?? 0))
    }
    for (const { w, start } of starts) {
      const limit = limits[w] as number
      const used = usedMap.get(w) ?? 0
      if (used >= limit) {
        const len = w === '5h' ? FIVE_HOURS_MS : w === '1d' ? 24 * 3600_000 : 7 * 24 * 3600_000
        return {
          allowed: false,
          blocked: { windowType: w, limit, used, resetsAtMs: start.getTime() + len },
        }
      }
    }
    return { allowed: true }
  } catch {
    if (failMode === 'close') return { allowed: true, backendUnavailable: true }
    return { allowed: true }
  }
}

/**
 * 窗口请求数 +1(recordCall 成功路径 fire-and-forget 调用)。
 * 自查该 Key 的三窗口限额(一次读),全 NULL 直接返回(存量 Key 零写入)。
 * UPSERT 累加,并发安全;失败静默,不影响调用结果。
 */
export async function incrKeyRateWindows(apiKeyId: string, at: Date = new Date()): Promise<void> {
  try {
    const [row] = await dbRead
      .select({
        rateLimit5h: developerApiKeys.rateLimit5h,
        rateLimit1d: developerApiKeys.rateLimit1d,
        rateLimit7d: developerApiKeys.rateLimit7d,
      })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, apiKeyId))
      .limit(1)
    if (!row) return
    const limits = limitsOf(row)
    const configured = ALL_KEY_WINDOWS.filter((w) => (limits[w] ?? 0) > 0)
    if (configured.length === 0) return
    for (const w of configured) {
      const start = getKeyWindowStart(w, at)
      await db
        .insert(keyRateWindowCounts)
        .values({ keyId: apiKeyId, windowType: w, windowStart: start, requestCount: 1 })
        .onConflictDoUpdate({
          target: [
            keyRateWindowCounts.keyId,
            keyRateWindowCounts.windowType,
            keyRateWindowCounts.windowStart,
          ],
          set: {
            requestCount: sql`${keyRateWindowCounts.requestCount} + 1`,
            updatedAt: new Date(),
          },
        })
    }
  } catch (e) {
    console.warn(
      '[key-rate-window] 窗口计数失败(不影响调用)',
      apiKeyId,
      e instanceof Error ? e.message : String(e),
    )
  }
}

/** Key 行的窗口限额是否全部未配置(用于跳过查询,存量 Key 零开销)。 */
export function hasAnyWindowLimit(limits: KeyWindowLimits): boolean {
  return (limits['5h'] ?? 0) > 0 || (limits['1d'] ?? 0) > 0 || (limits['7d'] ?? 0) > 0
}

// ============================================================================
// Key 级 IP ACL(黑名单优先 + 白名单)——单一算法落点(2026-09-21 立,O2)
// ============================================================================
// relay 计费(checkQuota)与鉴权主链路(requireApiKeyAuth)共用本函数,
// 匹配算法(ipInList,IPv4 + IPv6 + IPv4-mapped 归一)由调用方插件注入,
// 避免 service ↔ plugin 循环依赖。

export interface IpAclInput {
  /** 黑名单(jsonb 值,防御性接受任意元素) */
  blockedIps: unknown
  /** 白名单(jsonb 值,防御性接受任意元素) */
  allowedIps: unknown
  /** 请求方 IP */
  requestIp: string
}

export interface IpAclResult {
  ok: boolean
  /** 'ip_blocked'(黑名单命中,优先) | 'ip_not_allowed'(不在白名单) */
  reason?: string
}

/** 黑名单命中 → 403 优先于白名单;白名单存在且非空时不在名单内 → 拒绝。 */
export function checkKeyIpAcl(
  { blockedIps, allowedIps, requestIp }: IpAclInput,
  matches: (ip: string, list: readonly string[]) => boolean,
): IpAclResult {
  const blockedList = Array.isArray(blockedIps)
    ? (blockedIps as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  if (blockedList.length > 0 && matches(requestIp, blockedList)) {
    return { ok: false, reason: 'IP 在黑名单' }
  }
  const allowedList = Array.isArray(allowedIps)
    ? (allowedIps as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  if (allowedList.length > 0 && !matches(requestIp, allowedList)) {
    return { ok: false, reason: 'IP 不在白名单' }
  }
  return { ok: true }
}

// 引用 developerApiKeys 以保留未来直查扩展点(当前 checkQuota 已 select 出限额传入)
void developerApiKeys
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
