// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { REFRESH_FAILED, createRefreshStore } from './entitlement-refresh-store'

interface FakeSnapshot {
  balance: number
}

type FetchOutcome = { ok: true; value: FakeSnapshot } | { ok: false; error: unknown }

/** 假 fetcher + 假钟:排队的出参 + 手工推进时钟 */
function createHarness() {
  let nowMs = 0
  const fetcherCalls: string[] = []
  const queue: FetchOutcome[] = []
  const pending: Array<(outcome: FetchOutcome) => void> = []
  const store = createRefreshStore<FakeSnapshot, Record<string, unknown>>({
    fetcher: (options) => {
      fetcherCalls.push(JSON.stringify(options))
      const outcome = queue.shift()
      if (outcome) {
        return outcome.ok ? Promise.resolve(outcome.value) : Promise.reject(outcome.error)
      }
      return new Promise<FakeSnapshot>((resolve, reject) => {
        pending.push((o) => (o.ok ? resolve(o.value) : reject(o.error)))
      })
    },
    now: () => nowMs,
  })
  return {
    store,
    fetcherCalls,
    flush(outcome: FetchOutcome) {
      const settle = pending.shift()
      if (!settle) throw new Error('没有挂起的请求可结算')
      settle(outcome)
    },
    advance(ms: number) {
      nowMs += ms
    },
    get now() {
      return nowMs
    },
  }
}

describe('entitlement-refresh-store(G-977989 共享快照 + 失败退避 + generation)', () => {
  it('两个订阅者同 freshnessKey 只发一组请求(fetcher 调用数=1),成功广播给双方', async () => {
    const h = createHarness()
    const seenA: Array<[FakeSnapshot | null, string | undefined]> = []
    const seenB: Array<[FakeSnapshot | null, string | undefined]> = []
    h.store.subscribe('acct:1', (s, e) => seenA.push([s, e]))
    h.store.subscribe('acct:1', (s, e) => seenB.push([s, e]))

    const p1 = h.store.refresh('acct:1', { providerId: 'p1', includeSubscription: true })
    const p2 = h.store.refresh('acct:1', { includeSubscription: true, providerId: 'p1' })
    // in-flight 复用 + 请求键键序无关:两次 refresh 只打一次 fetcher
    expect(h.fetcherCalls).toHaveLength(1)
    h.flush({ ok: true, value: { balance: 42 } })
    await Promise.all([p1, p2])
    expect(seenA).toEqual([[{ balance: 42 }, undefined]])
    expect(seenB).toEqual([[{ balance: 42 }, undefined]])
  })

  it('失败 3 次后退避阶梯递进:窗口内应推迟,窗口外放行', () => {
    const h = createHarness()
    h.store.recordFailure('acct:1', h.now) // 第 1 次 → 30s
    expect(h.store.shouldDeferRefresh('acct:1', 29_999)).toBe(true)
    expect(h.store.shouldDeferRefresh('acct:1', 30_000)).toBe(false)
    h.store.recordFailure('acct:1', h.now) // 第 2 次 → 60s
    h.store.recordFailure('acct:1', h.now) // 第 3 次 → 120s
    expect(h.store.shouldDeferRefresh('acct:1', 60_000)).toBe(true)
    expect(h.store.shouldDeferRefresh('acct:1', 120_000)).toBe(false)
    expect(h.store.hasFailure('acct:1')).toBe(true)
  })

  it('失败是共享事实:error 广播给该键全部订阅者(带旧快照占位)', () => {
    const h = createHarness()
    h.store.subscribe('acct:1', () => {}) // 先占订阅位,第二批订阅者随后加入
    const seenEarly: Array<[FakeSnapshot | null, string | undefined]> = []
    h.store.subscribe('acct:1', (s, e) => seenEarly.push([s, e]))
    h.store.recordFailure('acct:1', h.now)
    expect(seenEarly).toEqual([[null, REFRESH_FAILED]])
  })

  it('新鲜窗口内不重查;窗口外失效;有失败记录时不兜旧值', async () => {
    const h = createHarness()
    const p = h.store.refresh('acct:1', {})
    h.flush({ ok: true, value: { balance: 7 } })
    await p
    // 新鲜窗口内直接用快照
    expect(h.store.shouldUseSnapshot('acct:1', 300_000, 1_000)).toEqual({ balance: 7 })
    // 窗口外失效
    expect(h.store.shouldUseSnapshot('acct:1', 300_000, 300_001)).toBeNull()
    // 失败后即使窗口内也不兜旧值
    h.store.recordFailure('acct:1', 2_000)
    expect(h.store.shouldUseSnapshot('acct:1', 300_000, 3_000)).toBeNull()
    // 成功回包会清失败态
    const p2 = h.store.refresh('acct:1', {})
    h.flush({ ok: true, value: { balance: 8 } })
    await p2
    expect(h.store.shouldUseSnapshot('acct:1', 300_000, 3_500)).toEqual({ balance: 8 })
    expect(h.store.hasFailure('acct:1')).toBe(false)
  })

  it('invalidate 递增 generation:旧请求 isCurrent()=false,requestKey 已变', () => {
    const h = createHarness()
    const r1 = h.store.beginRequest('acct:1', false)
    const r2 = h.store.beginRequest('acct:1', true)
    expect(r1.isCurrent()).toBe(false)
    expect(r2.isCurrent()).toBe(true)
    expect(r2.requestKey).not.toBe(r1.requestKey)
    // 无 invalidate 的后续请求沿用当代 requestKey
    const r3 = h.store.beginRequest('acct:1', false)
    expect(r3.requestKey).toBe(r2.requestKey)
    expect(r3.isCurrent()).toBe(true)
  })

  it('invalidate 后迟到的旧代成功回包不覆盖新态', async () => {
    const h = createHarness()
    const seen: Array<[FakeSnapshot | null, string | undefined]> = []
    h.store.subscribe('acct:1', (s, e) => seen.push([s, e]))
    const stale = h.store.refresh('acct:1', { v: 1 }) // 旧代,挂起
    const fresh = h.store.refresh('acct:1', { v: 1 }, { invalidate: true }) // 新代
    // pending 队列序 = 挂起序:先结算旧代
    h.flush({ ok: true, value: { balance: 1 } })
    h.flush({ ok: true, value: { balance: 2 } })
    await Promise.all([stale, fresh])
    // 只广播了新代回包,旧代被 generation 门拦下
    expect(seen).toEqual([[{ balance: 2 }, undefined]])
    expect(h.store.getSnapshot('acct:1')).toEqual({ balance: 2 })
  })

  it('refresh 失败自动记退避并广播 error;rethrow 给调用方', async () => {
    const h = createHarness()
    const seen: Array<[FakeSnapshot | null, string | undefined]> = []
    h.store.subscribe('acct:1', (s, e) => seen.push([s, e]))
    const p = h.store.refresh('acct:1', {})
    h.flush({ ok: false, error: new Error('网络挂了') })
    await expect(p).rejects.toThrow('网络挂了')
    expect(seen).toEqual([[null, REFRESH_FAILED]])
    expect(h.store.shouldDeferRefresh('acct:1', h.now + 29_999)).toBe(true)
  })

  it('access 查询 60s 去重', () => {
    const h = createHarness()
    h.store.recordAccess('acct:1', 0)
    expect(h.store.shouldDeferAccess('acct:1', 59_999)).toBe(true)
    expect(h.store.shouldDeferAccess('acct:1', 60_000)).toBe(false)
  })

  it('请求键:选项全字段参与且键序无关', () => {
    const h = createHarness()
    const a = h.store.buildRequestKey({ a: 1, b: [1, { c: 2, d: null }], e: 'x' })
    const b = h.store.buildRequestKey({ e: 'x', b: [1, { d: null, c: 2 }], a: 1 })
    expect(a).toBe(b)
    expect(a).toContain('"a":1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
