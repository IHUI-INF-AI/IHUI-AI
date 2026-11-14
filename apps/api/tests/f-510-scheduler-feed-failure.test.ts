// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-510 回归锁(2026-11-13)。
 *
 * 病灶:scheduler-worker 的 ai-feed-process / ai-feed-drain 把全链路异常 catch 成
 * 零值(快照 0 行、LLM/翻译 0 条、drain 全零 + zeroProgress)后仍记 success,
 * 面板在 LLM/快照全挂时显示"成功",内容流水线可静默停摆多天。
 *
 * 本文件锁:
 *   ① 阶段抛错 ⇒ 任务整体失败(上抛异常让调度器按 failCount/lastError 记账,
 *      recordJobExecution 只记 failed 不记 success),结构化日志带任务名/阶段/错误摘要;
 *   ② 同一任务内其他阶段不被拖垮(各阶段仍各自 catch 并执行);
 *   ③ 单个 job 失败不拖垮同一 tick 的后续任务;
 *   ④ 正常路径仍记 success;
 *   ⑤ ai-feed-drain 同理:异常 ⇒ failed,且互斥锁仍被释放。
 *
 * 全程不连真实 PG/Redis:db、queue、ai-feed-service、reconciliation-service 都是注入的假实现。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const state = vi.hoisted(() => ({
  failSnapshot: false,
  failLlm: false,
  failDrain: false,
}))

vi.mock('../src/plugins/queue.js', () => ({ createWorker: vi.fn() }))

vi.mock('../src/db/index.js', () => {
  const stub = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  }
  return {
    db: stub,
    dbRead: stub,
    dbScoped: stub,
    dbReadScoped: stub,
    dbClient: {},
    returningOne: vi.fn(),
    poolLeakDetector: {},
    stopPoolTracker: vi.fn(),
    registerPoolTrackerCleanup: vi.fn(),
    closeDbPools: vi.fn(),
  }
})

vi.mock('../src/services/ai-feed-service.js', () => ({
  collectAllSources: vi.fn(async () => ({ fetchedSources: 0, totalItems: 0, details: [] })),
  generateSnapshot: vi.fn(async () => {
    if (state.failSnapshot) throw new Error('snapshot: relation ai_feed_hot_item does not exist')
    return { insertedRows: 3 }
  }),
  processLlmBatch: vi.fn(async () => {
    if (state.failLlm) throw new Error('LLM upstream 502 Bad Gateway')
    return { processedItems: 5, failed: 0, details: '' }
  }),
  translateTitles: vi.fn(async () => ({ processedItems: 2, failed: 0, details: '' })),
  computeTrendSignals: vi.fn(async () => ({ processedItems: 1 })),
  drainLlmBacklog: vi.fn(async () => {
    if (state.failDrain) throw new Error('drain: LLM quota exceeded')
    return {
      llmProcessed: 4,
      translated: 2,
      classifiedFailed: 0,
      translateFailed: 0,
      iterations: 1,
      llmBacklogCleared: true,
      translateBacklogCleared: true,
      remainingNoLlm: 0,
      remainingNoEn: 0,
      zeroProgress: false,
    }
  }),
}))

vi.mock('../src/services/reconciliation-service.js', () => ({
  autoCloseExpiredOrders: vi.fn(async () => ({ scanned: 0, closed: [], failed: [] })),
  autoReconcileYesterday: vi.fn(async () => ({ date: '2026-11-13' })),
}))

vi.mock('../src/services/alert-notification-service.js', () => ({
  pushAlert: vi.fn(async () => undefined),
  pushAlertWithResult: vi.fn(async () => ({ ok: true })),
}))

import { startSchedulerWorker } from '../src/workers/scheduler-worker.js'
import { createWorker } from '../src/plugins/queue.js'
import { autoCloseExpiredOrders } from '../src/services/reconciliation-service.js'
import { translateTitles } from '../src/services/ai-feed-service.js'

const mockedCreateWorker = vi.mocked(createWorker)
const mockedCloseOrders = vi.mocked(autoCloseExpiredOrders)
const mockedTranslate = vi.mocked(translateTitles)

type JobProcessor = (job: { id?: string; name: string }) => Promise<unknown>

interface Harness {
  server: FastifyInstance
  recordJobExecution: ReturnType<typeof vi.fn>
  logError: ReturnType<typeof vi.fn>
  redisEval: ReturnType<typeof vi.fn>
}

function makeHarness(): Harness {
  const recordJobExecution = vi.fn()
  const logError = vi.fn()
  const redisEval = vi.fn(async () => 1)
  const server = {
    log: { info: vi.fn(), warn: vi.fn(), error: logError },
    startBizTimer: vi.fn(() => ({ end: vi.fn() })),
    recordJobExecution,
    redis: {
      set: vi.fn(async () => 'OK'),
      eval: redisEval,
    },
  } as unknown as FastifyInstance
  return { server, recordJobExecution, logError, redisEval }
}

/** 起 worker 并取出 processor(不连 BullMQ)。 */
function startProcessor(server: FastifyInstance): JobProcessor {
  mockedCreateWorker.mockClear()
  startSchedulerWorker(server)
  expect(mockedCreateWorker).toHaveBeenCalledTimes(1)
  return mockedCreateWorker.mock.calls[0]![2] as JobProcessor
}

/** recordJobExecution 的 (任务名, 状态) 序列。 */
function recordedStatuses(h: Harness): string[] {
  return h.recordJobExecution.mock.calls.map((c) => `${String(c[0])}|${String(c[1])}`)
}

/** 断言某次 error 日志严格带 jobName / stage / error 三格。 */
function expectStructuredStageError(h: Harness, stage: string, summaryPart: string): void {
  expect(h.logError).toHaveBeenCalledWith(
    expect.objectContaining({
      jobName: expect.any(String),
      stage,
      error: expect.stringContaining(summaryPart),
    }),
    expect.any(String),
  )
}

beforeEach(() => {
  state.failSnapshot = false
  state.failLlm = false
  state.failDrain = false
  mockedCloseOrders.mockClear()
  mockedTranslate.mockClear()
})

describe('F-510 ai-feed-process 不得吞异常记 success', () => {
  it('① 快照 + LLM 阶段都抛错 ⇒ 任务失败、带阶段摘要、只记 failed', async () => {
    state.failSnapshot = true
    state.failLlm = true
    const h = makeHarness()
    const processor = startProcessor(h.server)

    const err = await processor({ id: 'f510-p', name: 'ai-feed-process' }).then(
      () => null,
      (e: unknown) => e as Error,
    )

    expect(err, '异常被吞掉后正常返回 —— 又变成静默 success').toBeInstanceOf(Error)
    expect(err!.message).toContain('ai-feed-process')
    expect(err!.message).toContain('generateSnapshot')
    expect(err!.message).toContain('processLlmBatch')
    expect(err!.message).toContain('does not exist')
    expect(err!.message).toContain('502')

    expectStructuredStageError(h, 'generateSnapshot', 'does not exist')
    expectStructuredStageError(h, 'processLlmBatch', '502')

    expect(recordedStatuses(h)).toEqual(['ai-feed-process|failed'])

    // 同一任务内其余阶段仍执行(隔离保持),不因前两个失败而跳过
    expect(mockedTranslate).toHaveBeenCalledTimes(1)
  })

  it('② 单个 job 失败不拖垮同 tick 的后续任务', async () => {
    state.failSnapshot = true
    const h = makeHarness()
    const processor = startProcessor(h.server)

    await expect(processor({ id: 'f510-p', name: 'ai-feed-process' })).rejects.toThrow(
      /ai-feed-process failed/,
    )
    await processor({ id: 'f510-next', name: 'expired-order-cleanup' })

    expect(mockedCloseOrders).toHaveBeenCalledTimes(1)
    expect(recordedStatuses(h)).toEqual([
      'ai-feed-process|failed',
      'expired-order-cleanup|success',
    ])
  })

  it('③ 正常路径仍记 success 且返回各阶段结果', async () => {
    const h = makeHarness()
    const processor = startProcessor(h.server)

    const result = await processor({ id: 'f510-ok', name: 'ai-feed-process' })

    expect(result).toEqual({
      snapshot: { insertedRows: 3 },
      llm: { processedItems: 5, failed: 0, details: '' },
      translate: { processedItems: 2, failed: 0, details: '' },
      trend: { processedItems: 1 },
    })
    expect(recordedStatuses(h)).toEqual(['ai-feed-process|success'])
    expect(h.logError).not.toHaveBeenCalled()
  })
})

describe('F-510 ai-feed-drain 不得吞异常记 success', () => {
  it('④ drain 抛错 ⇒ 任务失败、带摘要、仍释放互斥锁', async () => {
    state.failDrain = true
    const h = makeHarness()
    const processor = startProcessor(h.server)

    const err = await processor({ id: 'f510-d', name: 'ai-feed-drain' }).then(
      () => null,
      (e: unknown) => e as Error,
    )

    expect(err, '异常被吞掉后正常返回 —— 又变成静默 success').toBeInstanceOf(Error)
    expect(err!.message).toContain('ai-feed-drain')
    expect(err!.message).toContain('drainLlmBacklog')
    expect(err!.message).toContain('quota exceeded')
    expectStructuredStageError(h, 'drainLlmBacklog', 'quota exceeded')
    expect(recordedStatuses(h)).toEqual(['ai-feed-drain|failed'])
    expect(h.redisEval, '失败路径漏释放 drain 互斥锁').toHaveBeenCalledTimes(1)
  })

  it('⑤ 正常路径仍记 success', async () => {
    const h = makeHarness()
    const processor = startProcessor(h.server)

    const result = await processor({ id: 'f510-d-ok', name: 'ai-feed-drain' })

    expect(result).toMatchObject({ llmProcessed: 4, translated: 2, zeroProgress: false })
    expect(recordedStatuses(h)).toEqual(['ai-feed-drain|success'])
  })
})
