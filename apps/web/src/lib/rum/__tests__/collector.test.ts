// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  RUM_MAX_BUFFERED_EVENTS,
  RUM_MAX_EVENTS_PER_SESSION,
  RumCollector,
  clampRumSamplingRate,
  startRumLongTaskWindow,
  systematicSampler,
  type RumCollectorOptions,
  type RumEvent,
} from '../collector'

function makeCollector(options: Partial<RumCollectorOptions> = {}): {
  collector: RumCollector
  batches: RumEvent[][]
} {
  const batches: RumEvent[][] = []
  const collector = new RumCollector({
    transport: (events) => {
      batches.push(events)
    },
    consent: () => true,
    samplingRate: 1,
    random: () => 0,
    now: () => 1_700_000_000_000,
    platform: () => 'linux',
    sampler: () => true,
    ...options,
  })
  return { collector, batches }
}

async function flushQueuedTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('RUM 采集：同意闸与采样', () => {
  it('关闭同意时 1000 条事件零请求，缓冲也为空', async () => {
    const batches: RumEvent[][] = []
    const collector = new RumCollector({
      transport: (events) => {
        batches.push(events)
      },
      consent: () => false,
      sampler: () => true,
    })
    for (let index = 0; index < 1000; index += 1) {
      expect(collector.record('rum_ai_ttft', { first_token_ms: index })).toBe(false)
    }
    await collector.flush()
    expect(batches).toHaveLength(0)
    expect(collector.getStats().buffered).toBe(0)
  })

  it('采样率为 0 时上报条数为 0', async () => {
    const { collector, batches } = makeCollector({ samplingRate: 0 })
    for (let index = 0; index < 1000; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
    }
    expect(await collector.flush()).toBe(0)
    expect(batches.flat()).toHaveLength(0)
  })

  it('采样率夹取上限为 1%', () => {
    expect(clampRumSamplingRate(1)).toBe(0.01)
    expect(clampRumSamplingRate(0.5)).toBe(0.01)
    expect(clampRumSamplingRate(-1)).toBe(0)
    expect(clampRumSamplingRate(Number.NaN)).toBe(0)
  })

  it('系统采样对 1000 条候选恰好产出 10 条（1% 硬上界）', () => {
    let accepted = 0
    for (let index = 1; index <= 1000; index += 1) {
      if (systematicSampler(index, 0.01, 0)) accepted += 1
    }
    expect(accepted).toBe(10)
  })

  it('默认采样下 1000 条事件实际上报 10 条', async () => {
    const batches: RumEvent[][] = []
    const collector = new RumCollector({
      transport: (events) => {
        batches.push(events)
      },
      consent: () => true,
      samplingRate: 1,
      random: () => 0,
      platform: () => 'linux',
    })
    for (let index = 0; index < 1000; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
    }
    expect(await collector.flush()).toBe(10)
    expect(batches.flat()).toHaveLength(10)
  })

  it('单会话硬上限 200 条：超出部分丢弃且不补报', async () => {
    const { collector } = makeCollector()
    for (let index = 0; index < 250; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
      // 每条都落盘，保证不会先撞到 50 条缓冲上限，专测"单会话 200 条硬上限"。
      await collector.flush()
    }
    const stats = collector.getStats()
    expect(stats.sessionDropped).toBe(50)
    expect(stats.sent + stats.buffered).toBeLessThanOrEqual(RUM_MAX_EVENTS_PER_SESSION)
  })

  it('缓冲满 50 条后新事件直接丢弃，不延后补报', async () => {
    const { collector } = makeCollector()
    for (let index = 0; index < 1000; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
    }
    // 第 20 条触发过一次 flush（同步进缓冲，异步发出），之后缓冲涨到 50 并开始丢弃。
    expect(collector.getStats().overflowDropped).toBe(930)
    expect(collector.getStats().buffered).toBe(RUM_MAX_BUFFERED_EVENTS)
  })
})

describe('RUM 采集：批量与失败', () => {
  it('达到 20 条立即触发一次批量上报', async () => {
    const { collector, batches } = makeCollector()
    for (let index = 0; index < 20; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
    }
    await flushQueuedTasks()
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(20)
  })

  it('30s 定时器会 flush 未满 20 条的缓冲', async () => {
    vi.useFakeTimers()
    try {
      const { collector, batches } = makeCollector()
      collector.start()
      for (let index = 0; index < 5; index += 1) {
        collector.record('rum_ai_ttft', { first_token_ms: index })
      }
      await vi.advanceTimersByTimeAsync(30_000)
      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('未同意时 start() 不创建定时器（零空转）', () => {
    vi.useFakeTimers()
    try {
      const collector = new RumCollector({
        transport: () => {},
        consent: () => false,
        sampler: () => true,
      })
      collector.start()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('上报失败静默丢弃，连续 2 次后熔断不再发请求', async () => {
    let attempts = 0
    const collector = new RumCollector({
      transport: () => {
        attempts += 1
        throw new Error('network down')
      },
      consent: () => true,
      sampler: () => true,
      platform: () => 'linux',
    })
    collector.recordRequestFailure('/api/v1/foo', 503)
    await collector.flush()
    expect(attempts).toBe(1)
    collector.recordRequestFailure('/api/v1/bar', 503)
    await collector.flush()
    expect(attempts).toBe(2)
    // 熔断后继续投递：不得再发任何请求（无重试风暴）。
    collector.recordRequestFailure('/api/v1/baz', 503)
    expect(await collector.flush()).toBe(0)
    expect(attempts).toBe(2)
    const stats = collector.getStats()
    expect(stats.breakerOpen).toBe(true)
    expect(stats.sent).toBe(0)
  })

  it('撤回同意后 flush 直接清空缓冲且零请求', async () => {
    let granted = true
    const batches: RumEvent[][] = []
    const collector = new RumCollector({
      transport: (events) => {
        batches.push(events)
      },
      consent: () => granted,
      sampler: () => true,
    })
    for (let index = 0; index < 5; index += 1) {
      collector.record('rum_ai_ttft', { first_token_ms: index })
    }
    granted = false
    expect(await collector.flush()).toBe(0)
    expect(batches).toHaveLength(0)
    expect(collector.getStats().buffered).toBe(0)
  })
})

describe('RUM 采集：请求失败聚合与错误脱敏', () => {
  it('同一接口+状态码聚合为一条事件并带 count', async () => {
    const { collector, batches } = makeCollector()
    for (let index = 0; index < 5; index += 1) {
      collector.recordRequestFailure(
        '/api/v1/sessions/123e4567-e89b-12d3-a456-426614174000/messages?token=secret#x',
        500,
      )
    }
    await collector.flush()
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(1)
    expect(batches[0]?.[0]?.name).toBe('rum_request_failure')
    expect(batches[0]?.[0]?.props).toMatchObject({
      api_path: '/api/v1/sessions/:id/messages',
      status: 500,
      count: 5,
    })
    expect(JSON.stringify(batches)).not.toContain('secret')
    expect(JSON.stringify(batches)).not.toContain('123e4567')
  })

  it('不同状态码各自聚合', async () => {
    const { collector, batches } = makeCollector()
    collector.recordRequestFailure('/api/v1/foo', 500)
    collector.recordRequestFailure('/api/v1/foo', 500)
    collector.recordRequestFailure('/api/v1/foo', 429)
    await collector.flush()
    expect(batches[0]).toHaveLength(2)
  })

  it('错误摘要中的路径与邮箱不会出现在上报体', async () => {
    const { collector, batches } = makeCollector()
    collector.recordError('error', new Error('failed at C:\\Users\\张三\\secret.txt for a@b.com'))
    await collector.flush()
    const body = JSON.stringify(batches)
    expect(body).not.toContain('张三')
    expect(body).not.toContain('secret.txt')
    expect(body).not.toContain('a@b.com')
    expect(batches[0]?.[0]?.props.message).toContain('<path>')
    expect(batches[0]?.[0]?.props.message).toContain('<email>')
  })

  it('全局 error 监听不 preventDefault，不吞业务异常，同时完成采集', async () => {
    const { collector, batches } = makeCollector()
    const cleanup = collector.installGlobalErrorHandlers()
    try {
      const event = new ErrorEvent('error', {
        error: new Error('boom C:\\Users\\张三\\secret.txt'),
        message: 'boom',
        cancelable: true,
      })
      const notCancelled = window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
      expect(notCancelled).toBe(true)
      await collector.flush()
      expect(batches.flat().some((item) => item.name === 'rum_error_uncaught')).toBe(true)
    } finally {
      cleanup()
    }
  })
})

describe('RUM 采集：AI 指标与长任务', () => {
  it('AI 完成事件拆成首 token 与完成两段，并带长任务数', async () => {
    const { collector, batches } = makeCollector()
    collector.recordAiCompletion({
      key: 'message-1',
      firstTokenMs: 800,
      durationMs: 4000,
      longTasks: 3,
    })
    await collector.flush()
    const events = batches.flat()
    expect(events.map((item) => item.name)).toEqual(['rum_ai_ttft', 'rum_ai_stream_done'])
    expect(events[0]?.props).toMatchObject({ first_token_ms: 800, platform: 'linux' })
    expect(events[1]?.props).toMatchObject({
      stream_ms: 3200,
      duration_ms: 4000,
      long_tasks: 3,
    })
  })

  it('同一 messageId 只记录一次（流式渲染幂等）', async () => {
    const { collector, batches } = makeCollector()
    collector.recordAiCompletion({
      key: 'message-1',
      firstTokenMs: 800,
      durationMs: 4000,
    })
    collector.recordAiCompletion({
      key: 'message-1',
      firstTokenMs: 900,
      durationMs: 5000,
    })
    await collector.flush()
    expect(batches.flat()).toHaveLength(2)
  })

  it('长任务计数器按 observer 条目数累计，stop 后清零', () => {
    const original = globalThis.PerformanceObserver
    const entries = [{ name: 'frame-a' }, { name: 'frame-b' }]
    class FakeObserver {
      static supportedEntryTypes = ['long-animation-frame']
      private callback: (list: { getEntries: () => typeof entries }) => void
      constructor(callback: (list: { getEntries: () => typeof entries }) => void) {
        this.callback = callback
      }
      observe(): void {
        this.callback({ getEntries: () => entries })
      }
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, 'PerformanceObserver', {
      configurable: true,
      value: FakeObserver as unknown as typeof PerformanceObserver,
    })
    try {
      const windowCounter = startRumLongTaskWindow()
      expect(windowCounter.stop()).toBe(2)
      expect(windowCounter.stop()).toBe(0)
    } finally {
      Object.defineProperty(globalThis, 'PerformanceObserver', {
        configurable: true,
        value: original,
      })
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
