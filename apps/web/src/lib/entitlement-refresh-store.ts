// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 共享快照刷新 store:同键共享查询 + 失败退避阶梯 + generation 失效
 * (机制吸收 G-977989;上游出处 zcode packages/ui/src/lib/usageEntitlementRefreshPolicy.ts:31-259,
 * 上游按 IUsageStatsService WeakMap 分域,本仓抽象成通用工厂,fetcher/时钟均可注入)。
 *
 * 核心规则:
 *  1. 同 freshnessKey 的所有入口共享一份快照与订阅者集合;并发刷新按请求键
 *     in-flight 复用 —— 同键多入口只发一组请求(调用方须保证同键同参);
 *  2. 失败退避阶梯 [30s,60s,120s,300s]:失败是**共享事实**,广播 error 给该键
 *     全部订阅者(设置页失败后,推荐入口不得再当旧查询成功);
 *  3. 购买/失效递增 generation:requestKey=JSON[freshnessKey,generation],旧代
 *     请求 isCurrent()=false;成功回包只有当代才写快照并广播(迟到旧包不覆盖新态);
 *  4. 新鲜窗口内不重查(shouldUseSnapshot);failureCount>0 即不兜旧值 ——
 *     退避窗口内宁可让调用方重查,不给可能已失效的旧快照;
 *  5. access 类查询 60s 去重;请求选项全字段 JSON 序列化做请求键(键序无关)。
 */

export const REFRESH_FAILURE_BACKOFF_MS: ReadonlyArray<number> = [30_000, 60_000, 120_000, 300_000]

/** access 类查询去重窗口 */
export const REFRESH_ACCESS_DEDUPE_MS = 60_000

/** 失败广播的稳定错误标记 */
export const REFRESH_FAILED = 'refresh_failed'

export type RefreshListener<TSnapshot> = (snapshot: TSnapshot | null, error?: string) => void

export interface BeginRequestHandle {
  requestKey: string
  isCurrent(): boolean
}

export interface RefreshStore<TSnapshot, TOptions> {
  subscribe(freshnessKey: string, listener: RefreshListener<TSnapshot>): () => void
  /**
   * 发起刷新:并发同键(同 generation)复用 in-flight;invalidate=true 递增
   * generation 使旧请求键失效。成功仅当代广播,失败记入共享退避并广播 error。
   */
  refresh(
    freshnessKey: string,
    options: TOptions,
    opts?: { invalidate?: boolean },
  ): Promise<TSnapshot>
  getSnapshot(freshnessKey: string): TSnapshot | null
  /** 新鲜窗口内返回快照;有失败记录(failureCount>0)时不兜旧值 */
  shouldUseSnapshot(freshnessKey: string, intervalMs: number, now: number): TSnapshot | null
  recordFailure(freshnessKey: string, now: number): void
  hasFailure(freshnessKey: string): boolean
  /** 失败退避窗口内为 true:调用方应推迟重查 */
  shouldDeferRefresh(freshnessKey: string, now: number): boolean
  beginRequest(freshnessKey: string, invalidate: boolean): BeginRequestHandle
  shouldDeferAccess(freshnessKey: string, now: number): boolean
  recordAccess(freshnessKey: string, now: number): void
  /** 请求选项全字段 JSON 序列化做请求键(键序无关) */
  buildRequestKey(options: TOptions): string
}

export interface CreateRefreshStoreOptions<TSnapshot, TOptions> {
  fetcher(options: TOptions): Promise<TSnapshot>
  /** 时钟可注入(测试用假钟);默认 Date.now */
  now?(): number
}

interface RefreshRecord<TSnapshot> {
  snapshot: TSnapshot
  updatedAt: number
  failureCount: number
  nextAllowedAt: number
}

interface FailureRecord {
  failureCount: number
  nextAllowedAt: number
}

/** 键序无关的 JSON 序列化:字段书写顺序不影响请求键命中 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function createRefreshStore<TSnapshot, TOptions>(
  options: CreateRefreshStoreOptions<TSnapshot, TOptions>,
): RefreshStore<TSnapshot, TOptions> {
  const fetcher = options.fetcher
  const now = options.now ?? Date.now
  const records = new Map<string, RefreshRecord<TSnapshot>>()
  const failures = new Map<string, FailureRecord>()
  const subscribers = new Map<string, Set<RefreshListener<TSnapshot>>>()
  const accessRequests = new Map<string, number>()
  const generations = new Map<string, number>()
  const inFlight = new Map<string, Promise<TSnapshot>>()

  const broadcast = (key: string, snapshot: TSnapshot | null, error?: string): void => {
    const listeners = subscribers.get(key)
    if (!listeners) return
    for (const listener of listeners) listener(snapshot, error)
  }

  const beginRequestInternal = (key: string, invalidate: boolean): BeginRequestHandle => {
    // 失效递增 generation:购买/换身份后,同键旧请求一并失效,不只靠单个调用方的版本号
    const generation = (generations.get(key) ?? 0) + (invalidate ? 1 : 0)
    generations.set(key, generation)
    return {
      requestKey: JSON.stringify([key, generation]),
      isCurrent: () => generations.get(key) === generation,
    }
  }

  const recordFailureInternal = (key: string, at: number): void => {
    const current = records.get(key)
    const previousFailureCount = current?.failureCount ?? failures.get(key)?.failureCount ?? 0
    const failureCount = previousFailureCount + 1
    const backoffMs =
      REFRESH_FAILURE_BACKOFF_MS[
        Math.min(failureCount - 1, REFRESH_FAILURE_BACKOFF_MS.length - 1)
      ] ?? REFRESH_FAILURE_BACKOFF_MS[REFRESH_FAILURE_BACKOFF_MS.length - 1]
    const nextAllowedAt = at + (backoffMs ?? 0)
    failures.set(key, { failureCount, nextAllowedAt })
    // 失败是共享事实:该键全部订阅者都要知道,不能只有发起入口自己知道
    broadcast(key, current?.snapshot ?? null, REFRESH_FAILED)
    if (!current) return
    records.set(key, { ...current, failureCount, nextAllowedAt })
  }

  return {
    subscribe(key, listener) {
      let set = subscribers.get(key)
      if (!set) {
        set = new Set()
        subscribers.set(key, set)
      }
      set.add(listener)
      return () => {
        const current = subscribers.get(key)
        if (!current) return
        current.delete(listener)
        if (current.size === 0) subscribers.delete(key)
      }
    },

    buildRequestKey(requestOptions) {
      return stableStringify(requestOptions)
    },

    beginRequest: beginRequestInternal,

    getSnapshot(key) {
      return records.get(key)?.snapshot ?? null
    },

    shouldUseSnapshot(key, intervalMs, at) {
      const record = records.get(key)
      if (!record) return null
      // 有失败记录就不兜旧值:退避窗口内宁可重查,不给可能已失效的旧快照
      if (record.failureCount > 0) return null
      if (at - record.updatedAt <= intervalMs) return record.snapshot
      return null
    },

    recordFailure: recordFailureInternal,

    hasFailure(key) {
      return failures.has(key)
    },

    shouldDeferRefresh(key, at) {
      const failure = failures.get(key)
      return Boolean(failure && failure.nextAllowedAt > at)
    },

    shouldDeferAccess(key, at) {
      const requestedAt = accessRequests.get(key)
      return requestedAt !== undefined && at - requestedAt < REFRESH_ACCESS_DEDUPE_MS
    },

    recordAccess(key, at) {
      accessRequests.set(key, at)
    },

    refresh(key, requestOptions, refreshOpts = {}) {
      const { requestKey, isCurrent } = beginRequestInternal(key, refreshOpts.invalidate === true)
      const existing = inFlight.get(requestKey)
      if (existing) return existing
      const promise = fetcher(requestOptions).then(
        (snapshot) => {
          inFlight.delete(requestKey)
          // 迟到的旧代回包不写不广播:generation 已被 invalidate 递增
          if (isCurrent()) {
            records.set(key, {
              snapshot,
              updatedAt: now(),
              failureCount: 0,
              nextAllowedAt: 0,
            })
            failures.delete(key)
            broadcast(key, snapshot)
          }
          return snapshot
        },
        (cause) => {
          inFlight.delete(requestKey)
          recordFailureInternal(key, now())
          throw cause
        },
      )
      inFlight.set(requestKey, promise)
      return promise
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
