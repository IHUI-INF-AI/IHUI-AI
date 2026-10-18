// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 在线/离线判据的判定级用例(票85④ 多端连通验证,2026-10-19 立)
 *
 * 本包没有 jsdom / @testing-library/react(实测:根 node_modules 无 RTL、无 react-dom),
 * 所以这里只测 `utils/connectivity` 的**纯函数层**(classifyRound / tracker / bannerKindFor);
 * 排期层(`hooks/use-connectivity` 的定时器续排)由 apps/web 的 RTL 用例端到端钉住 ——
 * 2026-10-19 就是在那条用例上捕获到"连续同档时第一轮重试后永久停摆"的缺陷。
 *
 * 钉的是三条不可漂的口径:
 *   ① 拿到任何 HTTP 响应(含 5xx)⇒ 路径通,**不是离线**;
 *   ② 探测失败 + 设备在线 ⇒ unknown,**绝不落 offline**;
 *   ③ 未判定不得渲染成已确认离线(bannerKindFor 把 unknown 拆成"不打扰 / 中性提示"两态)。
 */
import { describe, expect, it } from 'vitest'

import {
  bannerKindFor,
  classifyRound,
  createConnectivityTracker,
  DEFAULT_CONNECTIVITY_THRESHOLDS,
  type ProbeRound,
  type ProbeSample,
} from '../../src/utils/connectivity'

const T = 'http://api/health'

const answered = (latencyMs = 100, httpStatus = 200): ProbeSample => ({
  target: T,
  kind: 'response',
  httpStatus,
  latencyMs,
})
const unreachable: ProbeSample = { target: T, kind: 'unreachable', detail: 'ECONNREFUSED' }
const timeout: ProbeSample = { target: T, kind: 'timeout', latencyMs: 5_000 }

function round(deviceSignal: ProbeRound['deviceSignal'], samples: ProbeSample[]): ProbeRound {
  return { deviceSignal, samples }
}

describe('票85④ / classifyRound 三条不可漂的口径', () => {
  it('① 拿到响应即"通":2xx 与 5xx 同格(服务健康度不是连通性事实)', () => {
    for (const status of [200, 401, 500, 503]) {
      const ok = classifyRound(round('online', [answered(100, status)]), 0)
      expect(ok.status, `HTTP ${status} 必须读作"通"`).toBe('online')
      expect(ok.reason).toBe('server-answered')
      expect(ok.consecutiveFailedRounds).toBe(0)
    }
  })

  it('① 慢响应 ⇒ slow 一档,不是断网', () => {
    const slow = classifyRound(
      round('online', [answered(DEFAULT_CONNECTIVITY_THRESHOLDS.slowLatencyMs)]),
      0,
    )
    expect(slow.status).toBe('slow')
    expect(slow.reason).toBe('slow-response')
  })

  it('② 探测失败 + 设备在线 ⇒ unknown,不落离线(旧实现栽在这里)', () => {
    const s = classifyRound(round('online', [unreachable]), 0)
    expect(s.status).toBe('unknown')
    expect(s.reason).toBe('probe-target-unreachable')
    expect(s.detail.join(' ')).toContain('无法确认无网')
  })

  it('② 超时与 unreachable 同格(都是"没答",单独不足以判离线)', () => {
    const a = classifyRound(round('online', [timeout]), 0)
    const b = classifyRound(round('online', [unreachable]), 0)
    expect(a.status).toBe(b.status)
    expect(a.reason).toBe(b.reason)
  })

  it('② 设备信号报无网 + 也没答 ⇒ 才落 offline', () => {
    const s = classifyRound(round('offline', [unreachable]), 0)
    expect(s.status).toBe('offline')
    expect(s.reason).toBe('device-offline-signal')
  })

  it('② 交叉反证:设备报无网但目标答了 ⇒ 按应答为准,并点名记进 detail', () => {
    const s = classifyRound(round('offline', [answered()]), 0)
    expect(s.status).toBe('online')
    expect(s.detail.join(' ')).toContain('按应答为准')
  })

  it('③ 没有有效样本(no-sample)⇒ 未判定,不是在线也不是离线', () => {
    const s = classifyRound(round('online', []), 0)
    expect(s.status).toBe('unknown')
    expect(s.reason).toBe('no-sample')
    expect(s.latencyMs).toBeNull()
  })

  it('③ 有目标压根没探 ⇒ 覆盖面不闭合,不得据此下"离线"', () => {
    const s = classifyRound(
      round('unknown', [unreachable, { target: 'b', kind: 'not-probed', reason: '未配置' }]),
      9,
    )
    expect(s.status).toBe('unknown')
    expect(s.reason).toBe('probe-unavailable')
    expect(s.detail.join(' ')).toContain('覆盖面不闭合')
  })
})

describe('票85④ / tracker 跨轮计数:连续 N 轮全未答才允许升级 offline', () => {
  it('设备信号也判不出来 ⇒ 前两轮只到 pending-confirmation,第三轮才 offline', () => {
    const tracker = createConnectivityTracker()
    const unk = round('unknown', [unreachable])
    const r1 = tracker.observe(unk)
    expect(r1.status).toBe('unknown')
    expect(r1.reason).toBe('pending-confirmation')
    expect(r1.consecutiveFailedRounds).toBe(1)
    const r2 = tracker.observe(unk)
    expect(r2.status, '第 2 轮仍不得升级').toBe('unknown')
    expect(r2.consecutiveFailedRounds).toBe(2)
    const r3 = tracker.observe(unk)
    expect(r3.status).toBe('offline')
    expect(r3.reason).toBe('all-targets-unreachable')
  })

  it('任何一次应答把连续失败计数归零(网络一通立即解除,不等满轮)', () => {
    const tracker = createConnectivityTracker()
    tracker.observe(round('unknown', [unreachable]))
    tracker.observe(round('unknown', [unreachable]))
    const recovered = tracker.observe(round('online', [answered()]))
    expect(recovered.status).toBe('online')
    expect(recovered.consecutiveFailedRounds).toBe(0)
  })
})

describe('票85④ / bannerKindFor:未判定与已确认离线必须是两种可见形态', () => {
  it('online 不打扰;slow 出中性提示', () => {
    expect(bannerKindFor(classifyRound(round('online', [answered()]), 0))).toBe('none')
    expect(bannerKindFor(classifyRound(round('online', [answered(9_000)]), 0))).toBe('slow')
  })

  it('offline 才出"离线"档', () => {
    expect(bannerKindFor(classifyRound(round('offline', [unreachable]), 0))).toBe('offline')
    expect(
      bannerKindFor(classifyRound(round('unknown', [unreachable]), DEFAULT_CONNECTIVITY_THRESHOLDS.offlineConsecutiveRounds - 1)),
    ).toBe('offline')
  })

  it('unknown 分两态:目标持续不可达 ⇒ unconfirmed;冷启动/等下一轮 ⇒ 不打扰', () => {
    const unconfirmed = classifyRound(round('online', [unreachable]), 0)
    expect(unconfirmed.reason).toBe('probe-target-unreachable')
    expect(bannerKindFor(unconfirmed)).toBe('unconfirmed')

    const cold = classifyRound(round('online', []), 0)
    expect(cold.reason).toBe('no-sample')
    expect(bannerKindFor(cold), '冷启动不得以"未判定"打扰用户').toBe('none')

    const pending = classifyRound(round('unknown', [unreachable]), 0)
    expect(pending.reason).toBe('pending-confirmation')
    expect(bannerKindFor(pending), '单轮抖动不冒红').toBe('none')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
