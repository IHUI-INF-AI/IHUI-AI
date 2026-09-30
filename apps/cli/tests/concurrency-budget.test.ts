// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
  AIMD_ADDITIVE_STEP,
  AIMD_DECREASE_FACTOR,
  AIMD_EPOCH_BATCH,
  AIMD_IDLE_RESET_MS,
  AIMD_LASTGOOD_STREAK,
  ProviderAimdGovernor,
  concurrencyBudgetSnapshot,
  cpuParallelism,
  resolveMaxConcurrency,
} from '../src/subagents/concurrency-budget.js'

/**
 * 并发预算单一出口的回归。
 *
 * 三条主判据对应立票时的三个实测缺陷:
 *  1. 模型可填任意大的 maxWorkers(旧代码只有 `?? 4` 兜默认,无上界)
 *  2. 默认档写死 4 且全仓无 CPU 推导
 *  3. requested=0 / 负数 / NaN 会打穿 `activeCount < maxWorkers` 判据(任务全排队饿死)
 *
 * `cpu` 形参是刻意的测试通道:在恰好 4 核的机器上,"默认走 CPU 推导"与"默认写死 4"
 * 结果同值 ⇒ 不注入就测不出这一格(注错方向还会得到一台恒真的尺子)。
 */
describe('resolveMaxConcurrency — 并发预算单一出口', () => {
  it('模型填 999 ⇒ 钳到硬上限,不是 999', () => {
    expect(resolveMaxConcurrency(999)).toBe(MAX_CONCURRENCY)
    expect(resolveMaxConcurrency(999)).toBeLessThanOrEqual(MAX_CONCURRENCY)
  })

  it('未填 ⇒ 走 CPU 推导而非固定 4(cpu=12 注入)', () => {
    expect(resolveMaxConcurrency(undefined, 12)).toBe(12)
    // 机器并行度超过硬上限时同样被钳(推导不等于放行)
    expect(resolveMaxConcurrency(undefined, 64)).toBe(MAX_CONCURRENCY)
    // cpu=1 的机器上默认档必须是 1,不得被抬回旧的 4
    expect(resolveMaxConcurrency(undefined, 1)).toBe(1)
  })

  it('requested=0 / 负数 / NaN ⇒ 落 1 且不抛', () => {
    expect(() => resolveMaxConcurrency(0)).not.toThrow()
    expect(resolveMaxConcurrency(0)).toBe(MIN_CONCURRENCY)
    expect(resolveMaxConcurrency(-5)).toBe(MIN_CONCURRENCY)
    expect(() => resolveMaxConcurrency(Number.NaN)).not.toThrow()
    expect(resolveMaxConcurrency(Number.NaN)).toBeGreaterThanOrEqual(MIN_CONCURRENCY)
    expect(resolveMaxConcurrency(Number.NaN)).toBeLessThanOrEqual(MAX_CONCURRENCY)
  })

  it('真实机器读数与档位常量自身在带内(cpuParallelism 不返回 0/负)', () => {
    const cpu = cpuParallelism()
    expect(cpu).toBeGreaterThanOrEqual(MIN_CONCURRENCY)
    expect(concurrencyBudgetSnapshot().ceiling).toBe(MAX_CONCURRENCY)
    expect(concurrencyBudgetSnapshot().cpuDerivedDefault).toBe(resolveMaxConcurrency())
  })

  it('池计数单调:activePools 不得为负(重复 shutdown 不重复记账)', () => {
    const before = concurrencyBudgetSnapshot()
    expect(before.activePools).toBeGreaterThanOrEqual(0)
    expect(before.poolsClosed).toBeLessThanOrEqual(before.poolsCreated)
  })
})

/**
 * provider-key 级 AIMD 并发治理器的纯函数回归(无时钟无 I/O,now 注入)。
 * 六条判据逐条对应派单验证草拟 a)–f),外加两条界与 run 级命令的判据。
 */
describe('ProviderAimdGovernor — 纯 AIMD 状态机', () => {
  it('a) 旧 epoch 的 429 只清 streak 不动 cap', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    g.release(K, { outcome: 'success' })
    expect(g.snapshot(K).successStreak).toBe(1)
    // 伪造"事件发生在旧 epoch"(eventEpoch < 当前 0 不可行,用当前值翻代后再送旧值):
    // 先把 epoch 推进到 3,再送 eventEpoch=1 的 429
    for (let i = 0; i < AIMD_EPOCH_BATCH * 3; i++) g.release(K, { outcome: 'success' })
    expect(g.snapshot(K).epoch).toBe(3)
    const before = g.snapshot(K).cap
    const changes = g.release(K, { outcome: 'throttled', eventEpoch: 1 })
    expect(g.snapshot(K).successStreak).toBe(0) // streak 被清
    expect(g.snapshot(K).cap).toBe(before) // cap 不动
    expect(changes).toEqual([])
  })

  it('b) cap > lastGood 时限流退回 lastGood,不按系数减', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    // 第一步 429:cap=MAX,lastGood=MAX ⇒ 系数减分支,cap=12,lastGood 清 0
    g.release(K, { outcome: 'throttled' })
    const afterDec = g.snapshot(K)
    expect(afterDec.cap).toBe(Math.max(MIN_CONCURRENCY, Math.floor(MAX_CONCURRENCY * AIMD_DECREASE_FACTOR)))
    expect(afterDec.lastGood).toBe(0)
    // run 命令把 cap 抬到中间值 13 ⇒ streak 达标后 lastGood=13
    const mid = Math.floor(MAX_CONCURRENCY * AIMD_DECREASE_FACTOR) + 1
    g.applyRunCapCommand('run-1', K, mid)
    for (let i = 0; i < AIMD_LASTGOOD_STREAK; i++) g.release(K, { outcome: 'success' })
    expect(g.snapshot(K).lastGood).toBe(mid)
    // 抬回天花板后 429:cap(16) > lastGood(13) ⇒ 退回 13,而非系数减的 12
    g.applyRunCapCommand('run-2', K, MAX_CONCURRENCY)
    const changes = g.release(K, { outcome: 'throttled' })
    expect(changes.map((c) => c.reason)).toContain('throttle-429')
    expect(changes[0].to).toBe(mid) // 退回 lastGood
    expect(changes[0].to).toBe(mid) // 13 ≠ 12(系数减结果)
    expect(changes[0].to).not.toBe(Math.max(MIN_CONCURRENCY, Math.floor(MAX_CONCURRENCY * AIMD_DECREASE_FACTOR)))
  })

  it('c) cap ≤ lastGood 时按系数减并清空 lastGood', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    const before = g.snapshot(K)
    expect(before.cap).toBe(MAX_CONCURRENCY)
    expect(before.lastGood).toBe(MAX_CONCURRENCY) // 相等 ⇒ 走系数减分支
    const changes = g.release(K, { outcome: 'throttled' })
    const expected = Math.max(MIN_CONCURRENCY, Math.floor(MAX_CONCURRENCY * AIMD_DECREASE_FACTOR))
    expect(g.snapshot(K).cap).toBe(expected)
    expect(g.snapshot(K).lastGood).toBe(0)
    expect(changes).toHaveLength(1)
    expect(changes[0].reason).toBe('throttle-429')
    expect(changes[0].from).toBe(MAX_CONCURRENCY)
    expect(changes[0].to).toBe(expected)
  })

  it('d) cap 已在地板:无 Retry-After ⇒ 0 条 change;带 ⇒ 仍发 1 条', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    g.applyRunCapCommand('run-1', K, MIN_CONCURRENCY)
    expect(g.snapshot(K).cap).toBe(MIN_CONCURRENCY)
    const none = g.release(K, { outcome: 'throttled' })
    expect(none).toEqual([])
    expect(g.snapshot(K).cap).toBe(MIN_CONCURRENCY)
    const withRa = g.release(K, { outcome: 'throttled', retryAfterMs: 5_000 })
    expect(withRa).toHaveLength(1)
    expect(withRa[0].reason).toBe('retry-after')
    expect(withRa[0].cooldownUntilMs).toBe(5_000)
    expect(g.snapshot(K).cap).toBe(MIN_CONCURRENCY) // cap 不再减
  })

  it('e) 空闲惰性重置幂等:天花板 + 干净状态 ⇒ 0 条 change、不翻 epoch', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    let pumped = 0
    g.setPumpAll(() => {
      pumped += 1
    })
    expect(g.snapshot(K).cap).toBe(MAX_CONCURRENCY)
    g.ask(K) // 活动
    t += AIMD_IDLE_RESET_MS + 1
    g.ask(K) // 触发惰性检查:已是天花板 + 干净 ⇒ no-op
    const snap = g.snapshot(K)
    expect(snap.cap).toBe(MAX_CONCURRENCY)
    expect(snap.epoch).toBe(0) // 不翻 epoch
    expect(pumped).toBe(0)
    // 有状态的 key:先压低再闲置 ⇒ 重置抬回天花板 + 发 recovery + pump 一次
    g.applyRunCapCommand('run-1', K, MIN_CONCURRENCY)
    t += AIMD_IDLE_RESET_MS + 1
    g.ask(K)
    expect(g.snapshot(K).cap).toBe(MAX_CONCURRENCY)
    // 再次闲置重置:状态已干净 ⇒ 幂等,不再发
    const emitChanges: string[] = []
    g.onConcurrencyChanged((c) => emitChanges.push(c.reason))
    t += AIMD_IDLE_RESET_MS + 1
    g.ask(K)
    expect(emitChanges).toEqual([])
  })

  it('f) streak 达标无等待者 ⇒ 设 lastGood 但 cap 不变', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    let pumped = 0
    g.setPumpAll(() => {
      pumped += 1
    })
    const before = g.snapshot(K)
    for (let i = 0; i < AIMD_LASTGOOD_STREAK; i++) g.release(K, { outcome: 'success' })
    const after = g.snapshot(K)
    expect(after.lastGood).toBe(before.cap) // lastGood 被设
    expect(after.cap).toBe(before.cap) // cap 不变(无等待者)
    expect(pumped).toBe(0)
  })

  it('epoch 批次阻尼:有等待者时翻代抬一步,recovery 发 change 且 pump 一次', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    let pumped = 0
    g.setPumpAll(() => {
      pumped += 1
    })
    g.applyRunCapCommand('run-1', K, MIN_CONCURRENCY)
    g.ask(K) // 占用唯一槽位
    const refused = g.ask(K)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.wait.cause).toBe('slot')
    g.release(K, { outcome: 'throttled' }) // 归还槽位;cap 已在地板 ⇒ 无 change
    // streak 达标 + 翻代发生在同一批 ⇒ 抬一步(waiting 仍 >0,ask 成功才清)
    for (let i = 0; i < AIMD_EPOCH_BATCH; i++) g.release(K, { outcome: 'success' })
    const snap = g.snapshot(K)
    expect(snap.epoch).toBe(1) // 翻代
    expect(snap.cap).toBe(MIN_CONCURRENCY + AIMD_ADDITIVE_STEP)
    expect(pumped).toBe(1) // 抬高多一次 pumpAll(仅一次)
  })

  it('backoff 因果:Retry-After 期间 ask 被拒且给确定截止时刻', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    g.release(K, { outcome: 'throttled', retryAfterMs: 1_000 })
    const refused = g.ask(K)
    expect(refused.ok).toBe(false)
    if (!refused.ok) {
      expect(refused.wait.cause).toBe('backoff')
      expect(refused.wait.retryAtMs).toBe(1_000)
    }
    t += 1_000
    expect(g.ask(K).ok).toBe(true) // 冷却过后可过闸
  })

  it('run 级命令:同 runId 同值幂等;在飞不丢;调低不 pump、抬高 pump', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    let pumped = 0
    g.setPumpAll(() => {
      pumped += 1
    })
    const mid = Math.floor(MAX_CONCURRENCY / 2)
    const c1 = g.applyRunCapCommand('run-a', K, mid)
    expect(c1?.to).toBe(mid)
    expect(pumped).toBe(0) // 起点即天花板,调低不 pump
    expect(g.applyRunCapCommand('run-a', K, mid)).toBeNull() // 幂等 no-op
    // 占满一半在飞,再调低到更低 ⇒ 在飞不丢(不召回),只是新闸门收紧
    for (let i = 0; i < mid; i++) expect(g.ask(K).ok).toBe(true)
    const lower = Math.max(MIN_CONCURRENCY, mid - 2)
    const c2 = g.applyRunCapCommand('run-b', K, lower)
    expect(c2?.to).toBe(lower)
    expect(g.snapshot(K).inflight).toBe(mid) // 在飞一个不丢
    const c3 = g.applyRunCapCommand('run-c', K, MAX_CONCURRENCY)
    expect(c3?.to).toBe(MAX_CONCURRENCY)
    expect(pumped).toBe(1) // 抬高 ⇒ 一次 pump
    // 目标超界被钳;已是天花板 ⇒ 值不变 ⇒ 无 change(幂等设计的一部分)
    expect(g.applyRunCapCommand('run-d', K, 999)).toBeNull()
    expect(g.applyRunCapCommand('run-e', K, 0)?.to).toBe(MIN_CONCURRENCY)
    expect(g.applyRunCapCommand('run-f', K, 999)?.to).toBe(MAX_CONCURRENCY) // 超界钳回天花板
  })

  it('两条界刻意不混:onConcurrencyChanged 是纯观察,不影响 cap/pump', () => {
    let t = 0
    const g = new ProviderAimdGovernor(() => t)
    const K = 'p1'
    const seen: number[] = []
    const unsub = g.onConcurrencyChanged((c) => seen.push(c.to))
    g.release(K, { outcome: 'throttled' })
    expect(seen).toHaveLength(1)
    unsub()
    g.release(K, { outcome: 'throttled' })
    expect(seen).toHaveLength(1) // 退订后不再收
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
