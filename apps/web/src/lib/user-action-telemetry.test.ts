// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ACTION_HANDLE_NOOP,
  UserActionTelemetry,
  resolveActionCatalogEntry,
  type ActionTraceBatch,
  type ActionTraceConfig,
} from './user-action-telemetry'

/**
 * UI 动作遥测验收测试(2026-09-30 立,吸收批次 74 票 G-977990)。
 * 锁定验收:非 catalog 动作 NOOP 零开销 / 句柄超时自动 abandoned /
 * 队列超 256 丢包且 droppedSinceLastFlush 进下一批 / 字节+条数双上限切批 /
 * shutdown 后 active 全 abandoned。
 */

const RESOURCE = { instanceId: 'renderer-test' }

const FULL_CONFIG: ActionTraceConfig = {
  enabled: true,
  enabledGroups: ['core', 'settings'],
  sampleRatio: 1,
}

let now = 1000
const clock = { now: () => now }

function makeTelemetry(
  overrides?: Partial<{
    config: ActionTraceConfig
    sendBatch: (batch: ActionTraceBatch) => Promise<unknown> | unknown
    random: () => number
    limits: Partial<{ maxQueueSpans: number; maxBatchSpans: number; maxBatchBytes: number; flushDelayMs: number }>
  }>,
) {
  // 统一包一层 vi.fn:自定义实现走透传,默认实现可被断言 .mock 调用明细
  const sendBatch = overrides?.sendBatch ? vi.fn(overrides.sendBatch) : vi.fn()
  const telemetry = new UserActionTelemetry({
    config: overrides?.config ?? FULL_CONFIG,
    resource: RESOURCE,
    sendBatch,
    clock,
    random: overrides?.random ?? (() => 0),
    limits: { flushDelayMs: 60_000, ...overrides?.limits },
  })
  return { telemetry, sendBatch }
}

function sendAndComplete(
  telemetry: UserActionTelemetry,
  featureId = 'chat.composer',
  action = 'send',
  result?: { stateAfter?: string },
) {
  const handle = telemetry.start({ featureId, action, trigger: 'pointer' })
  handle.complete(result)
  return handle
}

beforeEach(() => {
  now = 1000
})

afterEach(() => {
  vi.useRealTimers()
})

describe('catalog allowlist', () => {
  it('featureId × action 命中判定与 operationKind 派生', () => {
    expect(resolveActionCatalogEntry('workspace.session', 'open')).toBeTruthy()
    expect(resolveActionCatalogEntry('workspace.session', 'nope')).toBeUndefined()
    expect(resolveActionCatalogEntry('unknown.feature', 'open')).toBeUndefined()

    expect(resolveActionCatalogEntry('workspace.session', 'delete')?.operationKind).toBe(
      'destructive',
    )
    expect(resolveActionCatalogEntry('workbench.file', 'open')?.operationKind).toBe('navigation')
    expect(resolveActionCatalogEntry('settings.model', 'change_default_model')?.operationKind).toBe(
      'preference',
    )
    expect(resolveActionCatalogEntry('chat.composer', 'send')?.operationKind).toBe('command')
    expect(resolveActionCatalogEntry('chat.composer', 'send')?.group).toBe('core')
    expect(resolveActionCatalogEntry('settings.model', 'change_default_model')?.group).toBe(
      'settings',
    )
  })
})

describe('三重门未命中返回 NOOP 零开销', () => {
  it('非 catalog 动作返回共享 NOOP,不进队列也不发批', async () => {
    const { telemetry, sendBatch } = makeTelemetry()
    const handle = telemetry.start({ featureId: 'unknown.feature', action: 'x', trigger: 'pointer' })
    expect(handle).toBe(ACTION_HANDLE_NOOP)

    // NOOP 句柄任何收口都是空操作
    handle.complete()
    handle.fail({ failureStage: 'stage' })
    handle.cancel()
    await telemetry.flush()

    expect(sendBatch).not.toHaveBeenCalled()
    expect(telemetry.pendingSpanCount).toBe(0)
  })

  it('总开关关/分组未开/采样未中均返回 NOOP', async () => {
    const disabled = makeTelemetry({ config: { ...FULL_CONFIG, enabled: false } })
    expect(disabled.telemetry.start({ featureId: 'chat.composer', action: 'send', trigger: 'pointer' })).toBe(
      ACTION_HANDLE_NOOP,
    )

    const coreOnly = makeTelemetry({
      config: { ...FULL_CONFIG, enabledGroups: ['core'] },
    })
    expect(
      coreOnly.telemetry.start({ featureId: 'settings.model', action: 'change_default_model', trigger: 'pointer' }),
    ).toBe(ACTION_HANDLE_NOOP)

    // random() >= sampleRatio → 丢弃;random() < sampleRatio → 采中
    const sampledOut = makeTelemetry({
      config: { ...FULL_CONFIG, sampleRatio: 0.5 },
      random: () => 0.5,
    })
    expect(sampledOut.telemetry.start({ featureId: 'chat.composer', action: 'send', trigger: 'pointer' })).toBe(
      ACTION_HANDLE_NOOP,
    )
    const sampledIn = makeTelemetry({
      config: { ...FULL_CONFIG, sampleRatio: 0.5 },
      random: () => 0.4,
    })
    expect(sampledIn.telemetry.start({ featureId: 'chat.composer', action: 'send', trigger: 'pointer' })).not.toBe(
      ACTION_HANDLE_NOOP,
    )
  })

  it('采中的动作完整走完生命周期并入队', async () => {
    const { telemetry, sendBatch } = makeTelemetry()
    const handle = telemetry.start({ featureId: 'chat.composer', action: 'send', trigger: 'keyboard' })
    now += 120
    handle.complete({ resultSource: 'cli' })

    await telemetry.flush()
    const batch = sendBatch.mock.calls[0]?.[0] as ActionTraceBatch
    expect(batch.instanceId).toBe('renderer-test')
    expect(batch.spans).toHaveLength(1)
    const span = batch.spans[0]!
    expect(span.attributes.outcome).toBe('completed')
    expect(span.attributes.trigger).toBe('keyboard')
    expect(span.attributes.resultSource).toBe('cli')
    expect(span.durationMs).toBe(120)
    expect(span.status).toBe('ok')
  })
})

describe('句柄超时自动 abandoned', () => {
  it('超时未收口自动记 abandoned,且句柄幂等不重复入队', async () => {
    vi.useFakeTimers()
    const { telemetry, sendBatch } = makeTelemetry({ limits: { flushDelayMs: 2_000 } })
    const handle = telemetry.start({
      featureId: 'chat.composer',
      action: 'send',
      trigger: 'pointer',
      timeoutMs: 50,
    })

    await vi.advanceTimersByTimeAsync(50)
    await telemetry.flush()

    const batch = sendBatch.mock.calls[0]?.[0] as ActionTraceBatch
    expect(batch.spans).toHaveLength(1)
    expect(batch.spans[0]?.attributes.outcome).toBe('abandoned')

    // 超时收口后句柄已失效:complete 不再产生新 span
    handle.complete()
    await telemetry.flush()
    expect(sendBatch).toHaveBeenCalledTimes(1)
  })

  it('未指定 timeoutMs 时用 catalog 默认 30s', async () => {
    vi.useFakeTimers()
    const { telemetry, sendBatch } = makeTelemetry({ limits: { flushDelayMs: 2_000 } })
    telemetry.start({ featureId: 'chat.composer', action: 'stop', trigger: 'pointer' })

    await vi.advanceTimersByTimeAsync(29_999)
    expect(sendBatch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await telemetry.flush()
    const batch = sendBatch.mock.calls[0]?.[0] as ActionTraceBatch
    expect(batch.spans[0]?.attributes.outcome).toBe('abandoned')
  })
})

describe('有界队列与丢包计数', () => {
  it('队列超 256 丢包,droppedSinceLastFlush 累计进下一批后清零', async () => {
    const { telemetry, sendBatch } = makeTelemetry({ limits: { maxBatchSpans: 1000 } })

    for (let i = 0; i < 260; i += 1) {
      sendAndComplete(telemetry)
    }
    expect(telemetry.pendingSpanCount).toBe(256)
    expect(telemetry.droppedSpanCount).toBe(4)

    await telemetry.flush()
    expect(sendBatch).toHaveBeenCalledTimes(1)
    const batch = sendBatch.mock.calls[0]?.[0] as ActionTraceBatch
    expect(batch.spans).toHaveLength(256)
    expect(batch.droppedCount).toBe(4)
    expect(telemetry.droppedSpanCount).toBe(0)

    // 下一批重新累计
    for (let i = 0; i < 258; i += 1) {
      sendAndComplete(telemetry)
    }
    await telemetry.flush()
    const batch2 = sendBatch.mock.calls[1]?.[0] as ActionTraceBatch
    expect(batch2.spans).toHaveLength(256)
    expect(batch2.droppedCount).toBe(2)
  })
})

describe('字节 + 条数双上限切批', () => {
  it('估算字节超限按单条切批,绝不发出超限批次', async () => {
    const { telemetry, sendBatch } = makeTelemetry({
      limits: { maxBatchSpans: 10, maxBatchBytes: 2200 },
    })
    // 普通空 span 估算 ~1000 字节;带 300 字符 stateAfter 后单条 ~1500(≤2200 可入批),
    // 两条 ~3000(>2200)→ 每批只能装 1 条
    for (let i = 0; i < 3; i += 1) {
      sendAndComplete(telemetry, 'chat.composer', 'send', { stateAfter: 'x'.repeat(300) })
    }
    await telemetry.flush()

    expect(sendBatch).toHaveBeenCalledTimes(3)
    for (const call of sendBatch.mock.calls) {
      expect((call[0] as ActionTraceBatch).spans).toHaveLength(1)
    }
  })

  it('单条就超限的 span 丢弃并计数,后续正常 span 的批次带上丢包数', async () => {
    const { telemetry, sendBatch } = makeTelemetry({ limits: { maxBatchBytes: 1500 } })

    // 带 2000 字符 stateAfter 的 span 单条估算 ~4900 字节 > 1500 → 丢弃
    sendAndComplete(telemetry, 'chat.composer', 'send', { stateAfter: 'x'.repeat(2000) })
    await telemetry.flush()
    expect(sendBatch).not.toHaveBeenCalled()
    expect(telemetry.droppedSpanCount).toBe(1)

    // 普通 span(无 stateAfter)估算 ~1000 ≤ 1500 → 正常入批,批次带上丢包数
    sendAndComplete(telemetry)
    await telemetry.flush()
    const batch = sendBatch.mock.calls[0]?.[0] as ActionTraceBatch
    expect(batch.spans).toHaveLength(1)
    expect(batch.droppedCount).toBe(1)
  })

  it('span 数达到单批上限自动触发 flush', async () => {
    const { telemetry, sendBatch } = makeTelemetry({ limits: { maxBatchSpans: 2 } })
    sendAndComplete(telemetry)
    sendAndComplete(telemetry, 'chat.composer', 'stop')
    await telemetry.flush()

    const batch = sendBatch.mock.calls[0]?.[0] as ActionTraceBatch
    expect(batch.spans).toHaveLength(2)
  })
})

describe('flush 与 shutdown', () => {
  it('flush promise 在途去重', async () => {
    let release!: (value?: unknown) => void
    const gate = new Promise<unknown>((resolve) => {
      release = resolve
    })
    const { telemetry } = makeTelemetry({ sendBatch: () => gate })
    sendAndComplete(telemetry)

    const p1 = telemetry.flush()
    const p2 = telemetry.flush()
    expect(p2).toBe(p1)
    release(undefined)
    await p1
  })

  it('传输失败吞掉(同步抛错与异步 reject 均不冒泡,span 消费不回压)', async () => {
    const throwing = makeTelemetry({
      sendBatch: () => {
        throw new Error('sync transport boom')
      },
    })
    sendAndComplete(throwing.telemetry)
    await expect(throwing.telemetry.flush()).resolves.toBeUndefined()

    const rejecting = makeTelemetry({ sendBatch: () => Promise.reject(new Error('async boom')) })
    sendAndComplete(rejecting.telemetry)
    await expect(rejecting.telemetry.flush()).resolves.toBeUndefined()
    expect(rejecting.telemetry.pendingSpanCount).toBe(0)
  })

  it('shutdown 把 active 全记 abandoned 再 flush;之后句柄收口无效', async () => {
    const { telemetry, sendBatch } = makeTelemetry()
    const handle1 = telemetry.start({ featureId: 'chat.composer', action: 'send', trigger: 'pointer' })
    const handle2 = telemetry.start({ featureId: 'chat.turn', action: 'retry', trigger: 'pointer' })
    sendAndComplete(telemetry, 'workbench.file', 'open') // 已完成的一条也在队列里

    await telemetry.shutdown()

    const batch = sendBatch.mock.calls[0]?.[0] as ActionTraceBatch
    expect(batch.spans).toHaveLength(3)
    const abandoned = batch.spans.filter((s) => s.attributes.outcome === 'abandoned')
    expect(abandoned).toHaveLength(2)

    // shutdown 后句柄已失效
    handle1.complete()
    handle2.fail({ failureStage: 'late' })
    await telemetry.flush()
    expect(sendBatch).toHaveBeenCalledTimes(1)
    expect(telemetry.pendingSpanCount).toBe(0)
  })

  it('尾随定时器:低流量下 2s 后自动 flush', async () => {
    vi.useFakeTimers()
    const { telemetry, sendBatch } = makeTelemetry({ limits: { flushDelayMs: 2_000 } })
    sendAndComplete(telemetry)
    expect(sendBatch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(sendBatch).toHaveBeenCalledTimes(1)
    expect((sendBatch.mock.calls[0]?.[0] as ActionTraceBatch).spans).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
