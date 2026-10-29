// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  applyUsageTruth,
  deriveStreamTelemetry,
  formatCompactCount,
  formatElapsedShort,
  type StreamTelemetryInput,
} from '../stream-telemetry'

const base: StreamTelemetryInput = {
  isStreaming: true,
  startedAt: 1_000,
  firstTokenAt: 1_400,
  endedAt: null,
  now: 3_000,
  chars: 160,
  tokens: null,
  runningTools: 0,
  hasReasoning: false,
  hasContent: true,
}

describe('deriveStreamTelemetry', () => {
  it('从未跑过 ⇒ waiting + 全部读数留空（不拿 0 冒充）', () => {
    const snap = deriveStreamTelemetry({ ...base, isStreaming: false, startedAt: null })
    expect(snap).toEqual({
      phase: 'waiting',
      elapsedMs: 0,
      ttftMs: null,
      charsPerSec: 0,
      tokensPerSec: null,
    })
  })

  it('四个阶段按优先级判定：tool > writing > thinking > waiting', () => {
    expect(deriveStreamTelemetry({ ...base, runningTools: 1 }).phase).toBe('tool')
    expect(deriveStreamTelemetry({ ...base, runningTools: 1, hasContent: false }).phase).toBe(
      'tool',
    )
    expect(deriveStreamTelemetry({ ...base, hasContent: false, hasReasoning: true }).phase).toBe(
      'thinking',
    )
    expect(deriveStreamTelemetry({ ...base, hasContent: false, hasReasoning: false }).phase).toBe(
      'waiting',
    )
    expect(deriveStreamTelemetry({ ...base, isStreaming: false }).phase).toBe('done')
  })

  it('耗时以 endedAt 为准（结束后不再随时间增长）', () => {
    const snap = deriveStreamTelemetry({
      ...base,
      isStreaming: false,
      endedAt: 5_000,
      now: 99_000,
    })
    expect(snap.elapsedMs).toBe(4_000)
  })

  it('首字延迟 = 首字时刻 - 开始时刻；没出字时为 null', () => {
    expect(deriveStreamTelemetry(base).ttftMs).toBe(400)
    expect(deriveStreamTelemetry({ ...base, firstTokenAt: null, hasContent: false }).ttftMs).toBe(
      null,
    )
  })

  it('速率窗口不足 200ms 时返回 0（不放大首帧）', () => {
    const snap = deriveStreamTelemetry({
      ...base,
      firstTokenAt: 2_900,
      now: 3_000,
      chars: 5,
    })
    expect(snap.charsPerSec).toBe(0)
  })

  it('字符速率按"首字之后"的窗口计算', () => {
    const snap = deriveStreamTelemetry({ ...base, now: 3_400, chars: 200 })
    expect(snap.charsPerSec).toBe(100)
  })

  it('token 未到达时 tokensPerSec 为 null；到达后按总耗时算', () => {
    expect(deriveStreamTelemetry(base).tokensPerSec).toBeNull()
    const snap = deriveStreamTelemetry({ ...base, tokens: 200, now: 3_000 })
    expect(snap.tokensPerSec).toBe(100)
  })
})

describe('applyUsageTruth', () => {
  it('权威值覆盖估算值，负数/零不覆盖', () => {
    const live = deriveStreamTelemetry(base)
    const merged = applyUsageTruth(live, {
      firstTokenMs: 620,
      durationMs: 8_400,
      totalTokens: 1_260,
    })
    expect(merged.ttftMs).toBe(620)
    expect(merged.elapsedMs).toBe(8_400)
    expect(merged.tokensPerSec).toBe(150)
  })

  it('usage 缺失时原样返回', () => {
    const live = deriveStreamTelemetry(base)
    expect(applyUsageTruth(live, null)).toBe(live)
  })

  it('零值字段保留实时估算（缺值 ≠ 0）', () => {
    const live = deriveStreamTelemetry(base)
    const merged = applyUsageTruth(live, {
      firstTokenMs: 0,
      durationMs: 0,
      totalTokens: 0,
    })
    expect(merged.ttftMs).toBe(live.ttftMs)
    expect(merged.elapsedMs).toBe(live.elapsedMs)
    expect(merged.tokensPerSec).toBe(live.tokensPerSec)
  })
})

describe('格式化读数（读数不得断行 ⇒ 必须短）', () => {
  it('formatCompactCount', () => {
    expect(formatCompactCount(0)).toBe('0')
    expect(formatCompactCount(999)).toBe('999')
    expect(formatCompactCount(1_000)).toBe('1k')
    expect(formatCompactCount(1_260)).toBe('1.3k')
    expect(formatCompactCount(12_600)).toBe('13k')
    expect(formatCompactCount(3_400_000)).toBe('3.4M')
    expect(formatCompactCount(-1)).toBe('')
  })

  it('formatElapsedShort', () => {
    expect(formatElapsedShort(0)).toBe('0.0s')
    expect(formatElapsedShort(8_400)).toBe('8.4s')
    expect(formatElapsedShort(63_000)).toBe('1m03s')
    expect(formatElapsedShort(3_720_000)).toBe('1h02m')
    expect(formatElapsedShort(-5)).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
