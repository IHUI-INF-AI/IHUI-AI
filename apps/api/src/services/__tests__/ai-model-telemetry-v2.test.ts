// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  alignTelemetryBucketStart,
  fillTelemetrySeries,
  mergeTelemetryCallAggregates,
  normalizeTelemetryModelName,
  resolveTelemetryAttributionKey,
  resolveTelemetryWindow,
  sanitizeTelemetryErrorMessage,
  telemetryBucketCount,
} from '../ai-model-telemetry-v2'

describe('resolveTelemetryWindow', () => {
  it('只接受 24h / 7d,其余一律回到 1h', () => {
    expect(resolveTelemetryWindow('24h')).toBe('24h')
    expect(resolveTelemetryWindow('7d')).toBe('7d')
    expect(resolveTelemetryWindow('5m')).toBe('1h')
    expect(resolveTelemetryWindow(undefined)).toBe('1h')
  })
})

describe('alignTelemetryBucketStart', () => {
  it('按桶宽对齐,并固定覆盖 bucketCount 个桶', () => {
    const now = new Date('2026-11-27T01:23:45.678Z').getTime()
    const start = alignTelemetryBucketStart(now, 300, 288)
    expect(new Date(start).getSeconds()).toBe(0)
    expect(new Date(start).getMinutes() % 5).toBe(0)
    expect(now - start).toBeGreaterThanOrEqual((288 - 1) * 300_000)
    expect(now - start).toBeLessThanOrEqual(288 * 300_000)
  })
})

describe('telemetryBucketCount', () => {
  it('三个窗口分别固定为 60 / 288 / 168 个桶', () => {
    expect(telemetryBucketCount(60, 60)).toBe(60)
    expect(telemetryBucketCount(1_440, 300)).toBe(288)
    expect(telemetryBucketCount(10_080, 3_600)).toBe(168)
  })

  it('非法输入不产生负数或小数桶', () => {
    expect(telemetryBucketCount(60, 0)).toBe(0)
    expect(telemetryBucketCount(-60, 60)).toBe(0)
    expect(telemetryBucketCount(61, 60)).toBe(61)
  })
})

describe('fillTelemetrySeries', () => {
  const now = new Date('2026-11-27T01:23:45.000Z').getTime()

  it('固定长度、缺桶补零、窗口外丢弃', () => {
    const start = alignTelemetryBucketStart(now, 60, 60)
    const series = fillTelemetrySeries(
      [
        { bucket: start / 1000, calls: 2, tokens: 10, errors: 1 },
        { bucket: start / 1000 + 120, calls: 1, tokens: 5, errors: 0 },
        { bucket: start / 1000 - 60, calls: 9, tokens: 99, errors: 9 },
        { bucket: start / 1000 + 60 * 60, calls: 7, tokens: 77, errors: 7 },
      ],
      now,
      60,
      60,
    )
    expect(series).toHaveLength(60)
    expect(series[0]).toMatchObject({ t: start, calls: 2, tokens: 10, errors: 1 })
    expect(series[2]).toMatchObject({ t: start + 120_000, calls: 1, tokens: 5, errors: 0 })
    expect(series.slice(3).every((p) => p.calls === 0 && p.tokens === 0 && p.errors === 0)).toBe(
      true,
    )
  })

  it('同桶多行累加,错误数单独可读', () => {
    const start = alignTelemetryBucketStart(now, 300, 288)
    const series = fillTelemetrySeries(
      [
        { bucket: start / 1000, calls: 1, tokens: 3, errors: 1 },
        { bucket: start / 1000, calls: 2, tokens: 4, errors: 0 },
      ],
      now,
      1_440,
      300,
    )
    expect(series[0]).toMatchObject({ calls: 3, tokens: 7, errors: 1 })
    expect(series.reduce((sum, point) => sum + point.calls, 0)).toBe(3)
  })
})

describe('normalizeTelemetryModelName', () => {
  it('剥离与当前 provider_code 一致的首段', () => {
    expect(normalizeTelemetryModelName('agnes/agnes-3.0-flash', 'agnes')).toBe('agnes-3.0-flash')
  })

  it('只剥一次且大小写不敏感,保留真实模型主体的斜杠', () => {
    expect(normalizeTelemetryModelName('QWEN/qwen/qwen3-max', 'qwen')).toBe('qwen/qwen3-max')
  })

  it('provider 不一致或没有 provider 时不改写', () => {
    expect(normalizeTelemetryModelName('openai/gpt-4o', 'agnes')).toBe('openai/gpt-4o')
    expect(normalizeTelemetryModelName('agnes-3.0-flash', '')).toBe('agnes-3.0-flash')
    expect(normalizeTelemetryModelName(null, 'agnes')).toBe('')
  })
})

describe('resolveTelemetryAttributionKey', () => {
  it('配置只有裸名时,provider/裸名 归并到裸名', () => {
    const ids = new Set(['agnes-3.0-flash'])
    expect(resolveTelemetryAttributionKey('agnes/agnes-3.0-flash', 'agnes', ids)).toBe(
      'agnes-3.0-flash',
    )
  })

  it('配置本身是真实斜杠模型时,精确同名优先,不剥前缀', () => {
    const ids = new Set(['qwen/qwen3-32b'])
    expect(resolveTelemetryAttributionKey('qwen/qwen3-32b', 'qwen', ids)).toBe('qwen/qwen3-32b')
  })

  it('同配置裸名+前缀名并存时,各自精确归属,不互相撞 key', () => {
    const ids = new Set(['qwen3-32b', 'qwen/qwen3-32b'])
    expect(resolveTelemetryAttributionKey('qwen/qwen3-32b', 'qwen', ids)).toBe('qwen/qwen3-32b')
    expect(resolveTelemetryAttributionKey('qwen3-32b', 'qwen', ids)).toBe('qwen3-32b')
  })

  it('配置未命中的日志保留原名,空模型归一为空串', () => {
    const ids = new Set(['agnes-3.0-flash'])
    expect(resolveTelemetryAttributionKey('openai/gpt-4o', 'agnes', ids)).toBe('openai/gpt-4o')
    expect(resolveTelemetryAttributionKey(null, 'agnes', ids)).toBe('')
  })
  it('配置为真实斜杠名而日志只记裸名时仍归并', () => {
    const configured = new Set(['qwen/qwen3-32b'])
    expect(resolveTelemetryAttributionKey('qwen3-32b', 'qwen', configured)).toBe('qwen/qwen3-32b')
  })
})

describe('mergeTelemetryCallAggregates', () => {
  it('同模型两行合并时计数/成本守恒,错误分项逐项相加', () => {
    const merged = mergeTelemetryCallAggregates(
      {
        calls: 2,
        tokens: 10,
        errors: 1,
        authErrors: 1,
        retryableErrors: 1,
        pricedCalls: 1,
        costCents: 0.1,
        p95LatencyMs: 1200,
        lastCallAt: '2026-11-27T03:00:00.000Z',
      },
      {
        calls: 3,
        tokens: 20,
        errors: 2,
        rateLimitErrors: 2,
        retryableErrors: 2,
        pricedCalls: 2,
        costCents: 0.2,
        p95LatencyMs: 800,
        lastCallAt: '2026-11-27T04:00:00.000Z',
      },
    )
    expect(merged).toMatchObject({
      calls: 5,
      tokens: 30,
      errors: 3,
      retryableErrors: 3,
      pricedCalls: 3,
      errorBreakdown: { auth: 1, rateLimit: 2 },
      lastCallAt: '2026-11-27T04:00:00.000Z',
    })
    expect(merged.costCents).toBe(0.3)
  })
})

describe('sanitizeTelemetryErrorMessage', () => {
  it('错误串中的密钥/URL userinfo 先脱敏再返回', () => {
    const raw =
      '401 Authorization: Bearer sk-live-abcdef1234567890 https://user:pass@example.com/v1'
    const safe = sanitizeTelemetryErrorMessage(raw)
    expect(safe).not.toContain('sk-live-abcdef1234567890')
    expect(safe).not.toContain('user:pass')
    expect(safe).toContain('REDACTED_SECRET')
  })

  it('空值归一为 null,超长错误截断到 2000 字符', () => {
    expect(sanitizeTelemetryErrorMessage(null)).toBeNull()
    expect(sanitizeTelemetryErrorMessage('   ')).toBeNull()
    expect(sanitizeTelemetryErrorMessage('x'.repeat(3000))?.length).toBe(2000)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
