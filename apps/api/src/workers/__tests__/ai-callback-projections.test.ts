// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * ai-callback worker 的投影接线锁(批次 4,2026-11-06 立)。
 *
 * 判的不是"端点跑通",而是三条接线事实:
 *  ① **落库之后**才 commitProjection(顺序反了 = 中途崩溃时投影谎报已落库);
 *  ② BullMQ 还有重试余量的中间失败**不得**写 failed(否则客户端在重试窗口读到伪终态);
 *  ③ 投影写失败只记日志 —— commitProjection reject 不得让 processor 抛错重试。
 *
 * 零生产依赖:queue/DB/投影服务全 mock,银行家式假 worker 只捕获 processor 与事件回调。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const commitCalls: unknown[][] = []
const failCalls: unknown[][] = []

vi.mock('../../plugins/queue.js', () => {
  let processor: ((job: unknown) => Promise<unknown>) | null = null
  const handlers = new Map<string, (...args: unknown[]) => void>()
  return {
    QUEUE_NAMES: { aiCallback: 'ai-callback-test' },
    createWorker: vi.fn(
      (_server: unknown, _name: string, fn: (job: unknown) => Promise<unknown>) => {
        processor = fn
        return {
          on: (event: string, handler: (...args: unknown[]) => void) =>
            handlers.set(event, handler),
          __run: (job: unknown) => processor!(job),
          __emit: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
        }
      },
    ),
  }
})

vi.mock('../../db/chat-queries.js', () => ({
  findMessageById: vi.fn(async () => ({ id: 'placeholder-1', metadata: { keep: true } })),
  updateMessage: vi.fn(async () => ({ id: 'placeholder-1', metadata: { keep: true } })),
  createMessage: vi.fn(async () => ({ id: 'placeholder-1', metadata: {} })),
}))

vi.mock('../../db/element-pack-queries.js', () => ({
  consumeElementPackFrames: vi.fn(async () => []),
}))

vi.mock('../../db/index.js', () => ({
  dbClient: { unsafe: vi.fn(async () => []) },
}))

vi.mock('../../services/chat-message-projections.js', () => ({
  commitProjection: vi.fn(async (...args: unknown[]) => {
    commitCalls.push(args)
    return true
  }),
  failProjection: vi.fn(async (...args: unknown[]) => {
    failCalls.push(args)
    return true
  }),
}))

import { startAiCallbackWorker } from '../ai-callback-worker.js'

type FakeWorker = {
  __run: (job: unknown) => Promise<unknown>
  __emit: (event: string, ...args: unknown[]) => void
}

const logWarn = vi.fn()
const server = {
  log: { warn: logWarn, error: vi.fn(), info: vi.fn() },
  // processor 落库后还会走扣费/推送两条旁路;这里给最小桩,确保被测的是投影接线本身。
  aiCost: { record: vi.fn(async () => undefined) },
  tokenBalance: { deductTokens: vi.fn(async () => ({ success: true, remaining: 0 })) },
  pushNotification: vi.fn(),
}

function makeJob(attemptsMade: number, attempts: number) {
  return {
    id: 'job-1',
    attemptsMade,
    opts: { attempts },
    data: {
      conversationId: 'conv-1',
      userId: 'user-1',
      messageId: 'client-msg-1',
      content: '终稿正文',
      reasoning: '推理',
      tokens: 42,
      metadata: {},
    },
  }
}

let worker: FakeWorker

beforeEach(() => {
  commitCalls.length = 0
  failCalls.length = 0
  logWarn.mockClear()
  worker = startAiCallbackWorker(server as never) as unknown as FakeWorker
})

describe('ai-callback worker 投影接线', () => {
  it('消息落库后以 committedMessageId 收敛投影', async () => {
    const result = (await worker.__run(makeJob(0, 3))) as { messageId: string }
    expect(result.messageId).toBe('placeholder-1')
    expect(commitCalls).toHaveLength(1)
    const [queryable, identity, part] = commitCalls[0]! as [
      { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> },
      { conversationId: string; clientMessageId: string },
      { committedMessageId?: string; content?: string },
    ]
    expect(typeof queryable.query).toBe('function')
    expect(identity).toEqual({
      conversationId: 'conv-1',
      clientMessageId: 'client-msg-1',
    })
    expect(part.committedMessageId).toBe('placeholder-1')
    expect(part.content).toBe('终稿正文')
  })

  it('commitProjection 抛错只记日志,processor 不失败(不触发 BullMQ 重试)', async () => {
    const mod = await import('../../services/chat-message-projections.js')
    vi.mocked(mod.commitProjection).mockRejectedValueOnce(new Error('projection boom'))
    await expect(worker.__run(makeJob(0, 3))).resolves.toBeDefined()
    expect(logWarn).toHaveBeenCalled()
  })

  it('仍有重试余量的中间失败不写 failed', () => {
    worker.__emit('failed', makeJob(1, 3), new Error('transient'))
    expect(failCalls).toHaveLength(0)
  })

  it('达到重试上限的终态失败写 failed 并带 errorCode', () => {
    const err = Object.assign(new Error('terminal'), { code: 'DB_WRITE_FAILED' })
    worker.__emit('failed', makeJob(3, 3), err)
    expect(failCalls).toHaveLength(1)
    const [queryable, identity, errorCode] = failCalls[0]! as [
      { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> },
      { conversationId: string; clientMessageId: string },
      string,
    ]
    expect(typeof queryable.query).toBe('function')
    expect(identity).toEqual({ conversationId: 'conv-1', clientMessageId: 'client-msg-1' })
    expect(errorCode).toBe('DB_WRITE_FAILED')
  })

  it('failProjection 自身失败不向 BullMQ 抛错', async () => {
    const mod = await import('../../services/chat-message-projections.js')
    vi.mocked(mod.failProjection).mockRejectedValueOnce(new Error('fail boom'))
    expect(() => worker.__emit('failed', makeJob(3, 3), new Error('terminal'))).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
    expect(logWarn).toHaveBeenCalled()
  })
})
