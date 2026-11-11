// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-88 回归锁(2026-11-11)。
 *
 * 病灶:batch-worker 的 catch 无条件把任务写成终态 failed 后再 throw,
 * 而 process* 入口在 TERMINAL_STATUSES(含 failed)时直接 return
 * ⇒ BullMQ 第 2/3 次重试一进来就被自己的终态闸短路,3 次 attempts 全部空转。
 *
 * 判据:只有最后一次 attempt 才允许写 failed;之前的 attempt 必须回写非终态
 * (in_progress)并 rethrow,让下一次重试能真正进入处理逻辑。
 *
 * 说明:不连 Redis/DB —— bullmq 与 batch-queue 全 mock,只驱动真实处理器闭包。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeJob {
  id: string
  data: { taskId: string; type: 'openai' | 'anthropic' }
  attemptsMade: number
  opts: { attempts: number }
}

interface StatusUpdate {
  taskId: string
  status: string
  errorMessage?: string
}

const state = vi.hoisted(() => ({
  processor: null as ((job: unknown) => Promise<unknown>) | null,
  updates: [] as StatusUpdate[],
  getTaskImpl: null as ((call: number) => Promise<unknown>) | null,
  getTaskCalls: 0,
}))

vi.mock('bullmq', () => ({
  Worker: class {
    constructor(_name: string, processor: (job: unknown) => Promise<unknown>) {
      state.processor = processor
    }
    on(): void {}
    async close(): Promise<void> {}
  },
}))

vi.mock('../src/queue/batch-queue.js', () => ({
  BATCH_QUEUE_NAME: 'batch-queue',
  getTask: vi.fn(async () => {
    state.getTaskCalls += 1
    return state.getTaskImpl ? state.getTaskImpl(state.getTaskCalls) : null
  }),
  updateBatchTaskStatus: vi.fn(
    async (
      _redis: unknown,
      taskId: string,
      status: string,
      patch?: { _errorMessage?: string },
    ) => {
      state.updates.push({ taskId, status, errorMessage: patch?._errorMessage })
      return null
    },
  ),
  getBatchInput: vi.fn(async () => null),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({ aiServiceFetch: vi.fn() }))

vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: vi.fn(async () => {}),
  modelToProviderCode: vi.fn(() => 'test-provider'),
}))

import { startBatchWorker, shouldMarkTerminalFailed } from '../src/workers/batch-worker.js'

function makeServer() {
  return {
    redis: {},
    redisForQueue: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    addHook: vi.fn(),
  }
}

/** 启动一次 worker 以捕获真实处理器闭包(不建立任何连接) */
function captureProcessor(): (job: unknown) => Promise<unknown> {
  state.processor = null
  startBatchWorker(makeServer() as unknown as Parameters<typeof startBatchWorker>[0])
  if (!state.processor) throw new Error('未捕获到 batch-worker 处理器')
  return state.processor
}

function makeJob(attemptsMade: number, attempts: number): FakeJob {
  return {
    id: 'job-1',
    data: { taskId: 'task-1', type: 'openai' },
    attemptsMade,
    opts: { attempts },
  }
}

beforeEach(() => {
  state.updates = []
  state.getTaskImpl = null
  state.getTaskCalls = 0
})

describe('shouldMarkTerminalFailed', () => {
  it('3 次 attempts 的前两次(attemptsMade=0/1)都不写终态', () => {
    expect(shouldMarkTerminalFailed(0, 3)).toBe(false)
    expect(shouldMarkTerminalFailed(1, 3)).toBe(false)
  })

  it('3 次 attempts 的最后一次(attemptsMade=2)写终态', () => {
    expect(shouldMarkTerminalFailed(2, 3)).toBe(true)
  })

  it('单次 attempts:第 1 次即终态', () => {
    expect(shouldMarkTerminalFailed(0, 1)).toBe(true)
  })

  it('字段缺失时保守处理:attemptsMade 缺失视为首次,attempts 缺失视为 1 次', () => {
    expect(shouldMarkTerminalFailed(undefined, 3)).toBe(false)
    expect(shouldMarkTerminalFailed(null, 3)).toBe(false)
    expect(shouldMarkTerminalFailed(0, undefined)).toBe(true)
    expect(shouldMarkTerminalFailed(0, null)).toBe(true)
  })

  it('非法值不产生「提前终态」', () => {
    expect(shouldMarkTerminalFailed(-1, 3)).toBe(false)
    expect(shouldMarkTerminalFailed(Number.NaN, 3)).toBe(false)
  })
})

describe('batch-worker 失败重试不被终态闸短路', () => {
  it('非最后 attempt:回写 in_progress 并 rethrow,不写 failed', async () => {
    const processor = captureProcessor()
    // 首次 getTask 抛错(模拟未预期异常),catch 内的二次 getTask 返回进行态
    state.getTaskImpl = async (call) => {
      if (call === 1) throw new Error('transient boom')
      return { status: 'in_progress' }
    }

    await expect(processor(makeJob(0, 3))).rejects.toThrow('transient boom')

    expect(state.updates).toEqual([{ taskId: 'task-1', status: 'in_progress', errorMessage: undefined }])
    expect(state.updates.some((u) => u.status === 'failed')).toBe(false)
  })

  it('最后 attempt:写终态 failed 并带 _errorMessage', async () => {
    const processor = captureProcessor()
    state.getTaskImpl = async (call) => {
      if (call === 1) throw new Error('final boom')
      return { status: 'in_progress' }
    }

    await expect(processor(makeJob(2, 3))).rejects.toThrow('final boom')

    expect(state.updates).toEqual([
      { taskId: 'task-1', status: 'failed', errorMessage: 'final boom' },
    ])
  })

  it('非最后 attempt 且任务已取消:不回退终态', async () => {
    const processor = captureProcessor()
    state.getTaskImpl = async (call) => {
      if (call === 1) throw new Error('boom after cancel')
      return { status: 'cancelled' }
    }

    await expect(processor(makeJob(1, 3))).rejects.toThrow('boom after cancel')

    expect(state.updates).toEqual([])
  })
})
