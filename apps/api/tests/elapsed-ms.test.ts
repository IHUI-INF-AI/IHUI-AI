// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 格② 「耗时样本必须单调钟 × 墙钟交叉校验」回归 —— apps/api/src/utils/elapsed-ms.ts 及三处消费者。
 *
 * 判据:
 *  - ④ 时钟回拨 / 休眠级跳变 ⇒ 样本标不可信、计数在案、elapsedMs=null;
 *    且不可信样本不喂熔断/least-latency(recordChannelResult(null) 不进 recent 窗口，只计数)，
 *    analytics 的 avg/p95 也把它排除(计数可见，不静默丢);
 *  - ⑤ 正常路径 elapsedMs 与旧 `Date.now()-start` 同值/同量级(等价回归);
 *  - ⑥ 变异(摘掉交叉校验)时 ④ 必红 —— 由本轮人工变异跑测留证。
 * 零连库:假时钟 + 假 keyPoolId，不触生产 PG/Redis 数据面。
 */
import { describe, it, expect, afterAll } from 'vitest'
import {
  startStopwatch,
  elapsedClockStats,
  CLOCK_DIVERGENCE_TOLERANCE_MS,
} from '../src/utils/elapsed-ms.js'
import {
  recordChannelResult,
  getRecentCalls,
  getUntrustedLatencySampleCount,
  getCircuitState,
  resetCircuit,
  stopRelayChannelRouterSweep,
} from '../src/services/relay-channel-router.js'
import { AnalyticsService } from '../src/services/clawdbot/analytics.js'

function fakeClocks(perf0 = 1000, wall0 = 1_700_000_000_000) {
  const clock = { perf: perf0, wall: wall0 }
  return {
    clock,
    clocks: {
      perfNow: () => clock.perf,
      wallNow: () => clock.wall,
    },
  }
}

afterAll(() => {
  stopRelayChannelRouterSweep()
})

describe('格② elapsed-ms 交叉校验', () => {
  it('⑤ 等价回归:双钟同速前进时 elapsedMs 与旧 Date.now()-start 逐字同值', () => {
    const wall0 = 1_700_000_000_000
    const { clock, clocks } = fakeClocks(1000, wall0)
    const sw = startStopwatch({ clocks })
    clock.perf += 137
    clock.wall += 137
    const s = sw.stop()
    expect(s.trustworthy).toBe(true)
    expect(s.elapsedMs).toBe(137)
    // 旧算法结果就是 wall 差 —— 可信路径下两者必须逐字相等，没有量级漂移
    expect(s.elapsedMs).toBe(clock.wall - wall0)
    expect(s.elapsedMs).toBe(s.wallMs)
  })

  it('⑤ 真钟冒烟:真实 setTimeout 下样本可信且与墙钟差同量级', async () => {
    const wall0 = Date.now()
    const sw = startStopwatch()
    await new Promise((r) => setTimeout(r, 30))
    const s = sw.stop()
    const wallDelta = Date.now() - wall0
    expect(s.trustworthy).toBe(true)
    expect(s.elapsedMs).not.toBeNull()
    expect(Math.abs((s.elapsedMs ?? 0) - wallDelta)).toBeLessThan(50)
  })

  it('④a 墙钟回拨(NTP 步进/唤醒):负差一律不可信、计数、elapsedMs=null', () => {
    const before = elapsedClockStats()
    const { clock, clocks } = fakeClocks()
    const sw = startStopwatch({ clocks })
    clock.perf += 100
    clock.wall -= 5000 // 时钟往回跳 5 秒 —— 旧算法会得到 -4900 直接喂熔断
    const s = sw.stop()
    expect(s.trustworthy).toBe(false)
    expect(s.reason).toBe('negative-delta')
    expect(s.elapsedMs).toBeNull()
    const after = elapsedClockStats()
    expect(after.negativeDelta).toBe(before.negativeDelta + 1)
    expect(after.untrustworthy).toBe(before.untrustworthy + 1)
  })

  it('④b 分歧超容差(休眠/容器迁移):标不可信、计数;容差本身可注入验证边界', () => {
    const before = elapsedClockStats()
    const { clock, clocks } = fakeClocks()
    const sw = startStopwatch({ clocks })
    clock.perf += 50
    clock.wall += 3_600_000 // 一小时跳变
    const s = sw.stop()
    expect(s.trustworthy).toBe(false)
    expect(s.reason).toBe('clock-divergence')
    expect(s.elapsedMs).toBeNull()
    expect(elapsedClockStats().divergence).toBe(before.divergence + 1)
    // 边界:分歧恰等于默认容差 ⇒ 仍可信(> 才判，不是 >=)
    const { clock: c2, clocks: cl2 } = fakeClocks()
    const sw2 = startStopwatch({ clocks: cl2 })
    c2.perf += 10
    c2.wall += 10 + CLOCK_DIVERGENCE_TOLERANCE_MS
    expect(sw2.stop().trustworthy).toBe(true)
  })

  it('④c 不可信样本不进熔断计数:latencyMs=null 只计数、不污染 recent 窗口;成败信号照常', async () => {
    const kp = 'kp-elapsed-ms-cross-check-test'
    const base = getUntrustedLatencySampleCount()
    await recordChannelResult(kp, false, null)
    expect(getRecentCalls(kp)).toHaveLength(0)
    expect(getUntrustedLatencySampleCount()).toBe(base + 1)
    await recordChannelResult(kp, false, null)
    await recordChannelResult(kp, false, null)
    // 熔断仍吃成功/失败:连续 3 次失败 → open
    const st = await getCircuitState(kp)
    expect(st.failureCount).toBe(3)
    expect(st.state).toBe('open')
    // 可信样本仍按旧行为进窗口(回归)
    await recordChannelResult(kp, true, 120)
    const recent = getRecentCalls(kp)
    expect(recent).toHaveLength(1)
    expect(recent[0]?.latencyMs).toBe(120)
    const st2 = await getCircuitState(kp)
    expect(st2.state).toBe('closed')
    await resetCircuit(kp)
  })

  it('④d analytics:不可信耗时不计 avg/p95,但记录保留、计数可见(不静默丢)', () => {
    const svc = new AnalyticsService()
    const base = { botId: 'b1', sessionId: 's1', intent: 'i1', success: true }
    svc.record({ ...base, latencyMs: 50 })
    svc.record({ ...base, latencyMs: 100 })
    svc.record({ ...base, latencyMs: -9000 }) // 负值兜底判不可信(时钟回拨到达 analytics 的最后防线)
    svc.record({ ...base, latencyMs: 99999, latencyTrusted: false }) // 生产者侧已判不可信
    const sum = svc.getSummary()
    expect(sum.totalCalls).toBe(4)
    expect(sum.untrustedLatencyExcluded).toBe(2)
    expect(sum.avgLatencyMs).toBe(75)
    expect(sum.p95LatencyMs).toBe(100)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
