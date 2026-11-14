// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-494 回归锁(2026-11-13)。
 *
 * 病灶:batch-worker 先 SET NX 占去重键、再 fire-and-forget 扣费。
 * 扣费失败时去重键已存在 → 重试被跳过(漏收),异常重入又可能重复开票(重扣)。
 *
 * 判据:
 * 1) 正常路径必须先 await 扣费成功,再落带 settled 标记的去重键;
 * 2) 扣费失败(含 recordCall 吞异常返回空 logId)⇒ 去重键不残留,作业抛错可重试;
 * 3) 重复执行同一 taskId+行标识不重复扣费,且记 info;
 * 4) 正常单次执行只扣一次。
 *
 * 说明:不连 Redis/DB —— bullmq / batch-queue / billing / ai-service 全 mock,
 * 只驱动真实处理器闭包,并断言调用顺序。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeJob {
  id: string
  data: { taskId: string; type: 'openai' | 'anthropic' }
  attemptsMade: number
  opts: { attempts: number }
}

interface BillingInput {
  metadata?: Record<string, unknown>
}

const DEDUP_KEY = 'batch:billing:dedup:task-494:c1'

const state = vi.hoisted(() => ({
  processor: null as ((job: unknown) => Promise<unknown>) | null,
  store: new Map<string, string>(),
  events: [] as string[],
  updates: [] as { taskId: string; status: string }[],
  billingCalls: [] as BillingInput[],
  billingImpl: null as null | ((input: unknown) => Promise<unknown>),
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
  getTask: vi.fn(async () => ({
    status: 'pending',
    input_file_id: 'file-1',
    _apiKeyId: 'key-1',
    _userId: 'user-1',
  })),
  updateBatchTaskStatus: vi.fn(async (_redis: unknown, taskId: string, status: string) => {
    state.updates.push({ taskId, status })
    return null
  }),
  getBatchInput: vi.fn(async () =>
    JSON.stringify({
      custom_id: 'c1',
      method: 'POST',
      url: '/v1/chat/completions',
      body: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    }),
  ),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: 'hello',
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    }),
  })),
}))

vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: vi.fn(async (input: unknown) => {
    state.billingCalls.push(input as BillingInput)
    const key = String((input as BillingInput).metadata?.idempotencyKey ?? '')
    state.events.push(`billing:${key}`)
    if (state.billingImpl) return state.billingImpl(input)
    return { logId: 'log-1' }
  }),
  modelToProviderCode: vi.fn(() => 'test-provider'),
}))

import { startBatchWorker } from '../src/workers/batch-worker.js'

const fakeRedis = {
  async set(key: string, value: string, ..._rest: unknown[]): Promise<string> {
    state.store.set(key, value)
    state.events.push(`dedup:set:${key}`)
    return 'OK'
  },
  async get(key: string): Promise<string | null> {
    return state.store.get(key) ?? null
  },
  async del(key: string): Promise<number> {
    return state.store.delete(key) ? 1 : 0
  },
}

function makeJob(): FakeJob {
  return {
    id: 'job-494',
    data: { taskId: 'task-494', type: 'openai' },
    attemptsMade: 0,
    opts: { attempts: 3 },
  }
}

function capture() {
  const server = {
    redis: fakeRedis,
    redisForQueue: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    addHook: vi.fn(),
  }
  state.processor = null
  startBatchWorker(server as unknown as Parameters<typeof startBatchWorker>[0])
  if (!state.processor) throw new Error('未捕获到 batch-worker 处理器')
  return { process: state.processor, server }
}

/** 等待条件成立(仅用于观察「扣费进行中」这一瞬时状态) */
async function waitFor(fn: () => boolean, tries = 100): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (fn()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('waitFor 超时')
}

beforeEach(() => {
  state.processor = null
  state.store.clear()
  state.events = []
  state.updates = []
  state.billingCalls = []
  state.billingImpl = null
  vi.clearAllMocks()
})

describe('F-494 批处理扣费顺序与幂等', () => {
  it('① 正常路径:扣费完成后才落去重键(顺序断言)', async () => {
    let releaseBilling!: () => void
    state.billingImpl = () =>
      new Promise((resolve) => {
        releaseBilling = () => resolve({ logId: 'log-1' })
      })

    const { process } = capture()
    const running = process(makeJob())

    // 扣费已经开始但尚未返回
    await waitFor(() => state.billingCalls.length === 1)
    expect(state.store.has(DEDUP_KEY)).toBe(false)

    releaseBilling()
    await running

    expect(state.store.get(DEDUP_KEY)).toBe('settled')
    expect(state.events).toEqual(['billing:task-494:c1', `dedup:set:${DEDUP_KEY}`])
  })

  it('② 扣费失败 ⇒ 去重键不残留、作业抛错可重试', async () => {
    // 模拟 recordCall 顶层吞异常后返回空 logId(真实实现的行为)
    state.billingImpl = async () => ({ logId: '' })

    const { process, server } = capture()
    await expect(process(makeJob())).rejects.toThrow('batch billing failed')

    expect(state.store.has(DEDUP_KEY)).toBe(false)
    expect(state.events.some((e) => e.startsWith('dedup:set:'))).toBe(false)
    expect(state.updates.some((u) => u.status === 'completed')).toBe(false)
    expect(state.updates.some((u) => u.status === 'failed')).toBe(false)
    expect(server.log.error).toHaveBeenCalled()

    // 恢复后重试:能继续扣费并完成
    state.billingImpl = null
    const retried = await process(makeJob())
    expect(retried).toBeUndefined()
    expect(state.store.get(DEDUP_KEY)).toBe('settled')
    expect(state.updates.some((u) => u.status === 'completed')).toBe(true)
  })

  it('③ 重复执行同一 taskId/行标识不重复扣费,并记 info', async () => {
    const { process, server } = capture()
    await process(makeJob())
    expect(state.billingCalls).toHaveLength(1)

    await process(makeJob())
    expect(state.billingCalls).toHaveLength(1)
    expect(server.log.info).toHaveBeenCalledWith(
      { taskId: 'task-494', customId: 'c1' },
      'batch-worker[openai]: 该行已结算,跳过重复扣费',
    )
  })

  it('④ 正常单次执行只扣一次,去重键只落一次', async () => {
    const { process } = capture()
    await process(makeJob())

    expect(state.billingCalls).toHaveLength(1)
    expect(state.events.filter((e) => e.startsWith('billing:'))).toHaveLength(1)
    expect(state.events.filter((e) => e.startsWith('dedup:set:'))).toHaveLength(1)
    expect(state.updates.map((u) => u.status)).toEqual(['in_progress', 'finalizing', 'completed'])
  })
})
