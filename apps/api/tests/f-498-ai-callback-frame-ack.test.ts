// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

/**
 * F-498 回归:AI 回调 worker 的元素包帧改为「先读 → 落库 → 确认删除」两段式。
 *
 * 锁四条不变量:
 * ① 落库失败 ⇒ 暂存帧未被删除,同一帧可被重试再次取到;
 * ② 落库成功 ⇒ 帧被确认删除;
 * ③ 重复处理同一帧 ⇒ 不重复归并落库(帧幂等键 kind+id+timestamp);
 * ④ 正常路径顺序 = 取出(read) → 落库(persist) → 确认(confirm)。
 *
 * 零 DB 副作用:db / chat-queries / element-pack-queries / queue 全 mock。
 */

const SPAWN = {
  kind: 'subagent_spawn',
  id: 'sa1',
  role: 'researcher',
  task: '查资料',
  timestamp: '2026-11-13T00:00:00.000Z',
}

// 暂存表内存模型 + 调用顺序观测点
const h = vi.hoisted(() => ({
  frames: [] as Record<string, unknown>[],
  ops: [] as string[],
  deleted: [] as string[],
}))

vi.mock('../src/plugins/queue.js', () => ({
  createWorker: vi.fn(),
  QUEUE_NAMES: { aiCallback: 'aiCallback' },
}))

// 读取面:只有 SELECT,不删除(旧实现 DELETE ... RETURNING 在此处就丢帧)
vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          h.ops.push('read')
          return h.frames.length > 0 ? [{ frames: [...h.frames] }] : []
        },
      }),
    }),
  },
  dbRead: {},
}))

vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn(),
  findMessageById: vi.fn(),
  updateMessage: vi.fn(),
}))

vi.mock('../src/db/element-pack-queries.js', () => ({
  consumeElementPackFrames: vi.fn(),
}))

vi.mock('../src/plugins/ai-cost.js', () => ({ resolveAiCost: vi.fn() }))
vi.mock('../src/plugins/token-balance-service.js', () => ({ settleWalletUsage: vi.fn() }))

import { startAiCallbackWorker } from '../src/workers/ai-callback-worker.js'
import { createWorker, type AICallbackJobData } from '../src/plugins/queue.js'
import { createMessage, findMessageById, updateMessage } from '../src/db/chat-queries.js'
import { consumeElementPackFrames } from '../src/db/element-pack-queries.js'

const mockedCreateWorker = vi.mocked(createWorker)
const mockedUpdate = vi.mocked(updateMessage)
const mockedCreate = vi.mocked(createMessage)
const mockedFind = vi.mocked(findMessageById)
const mockedConsume = vi.mocked(consumeElementPackFrames)

let server: FastifyInstance
let processor: (job: { id?: string; data: AICallbackJobData }) => Promise<unknown>
let savedMetadata: Record<string, unknown> | undefined

function makeServer(): FastifyInstance {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    aiCost: { record: vi.fn().mockResolvedValue({ cost: 0, currency: 'CNY' }) },
    pushNotification: vi.fn(),
  } as unknown as FastifyInstance
}

function makeJob(): { id: string; data: AICallbackJobData } {
  return {
    id: 'job-1',
    data: {
      conversationId: 'conv-1',
      userId: 'user-1',
      messageId: 'msg-1',
      content: 'AI 回复',
      tokens: 0,
      metadata: { model: 'm1' },
    },
  }
}

function savedFrames(): unknown[] {
  const pack = savedMetadata?.elementPack as { frames?: unknown[] } | undefined
  return pack?.frames ?? []
}

beforeEach(() => {
  vi.clearAllMocks()
  h.frames = []
  h.ops = []
  h.deleted = []
  savedMetadata = undefined

  mockedFind.mockReset()
  mockedFind.mockResolvedValue(undefined)
  mockedCreate.mockReset()
  mockedUpdate.mockReset()
  mockedUpdate.mockImplementation((async (
    _messageId: string,
    _userId: string,
    patch: { metadata?: Record<string, unknown> },
  ) => {
    h.ops.push('persist')
    savedMetadata = patch.metadata
    return { id: 'msg-db-1' }
  }) as never)

  mockedConsume.mockReset()
  mockedConsume.mockImplementation((async (conversationId: string, clientMessageId: string) => {
    h.ops.push('confirm')
    h.deleted.push(`${conversationId}|${clientMessageId}`)
    h.frames = []
    return []
  }) as never)

  mockedCreateWorker.mockClear()
  server = makeServer()
  startAiCallbackWorker(server)
  processor = mockedCreateWorker.mock.calls[0]![2] as typeof processor
})

describe('F-498 回调帧两段式确认', () => {
  it('① 落库失败:帧未被删除,warn 含帧 id,重试仍能取到并落库', async () => {
    h.frames = [SPAWN]
    mockedUpdate.mockImplementationOnce((async () => {
      h.ops.push('persist')
      throw new Error('deadlock detected')
    }) as never)

    await expect(processor(makeJob())).rejects.toThrow('deadlock detected')

    // 帧仍在暂存表,且没有任何删除动作
    expect(h.frames).toEqual([SPAWN])
    expect(mockedConsume).not.toHaveBeenCalled()
    expect(h.deleted).toEqual([])

    // 失败告警带上帧标识,便于按帧定位
    const warnPayload = JSON.stringify(vi.mocked(server.log.warn).mock.calls)
    expect(warnPayload).toContain('subagent_spawn:sa1')

    // 重试:同一帧再次被读取并随消息落库
    await processor(makeJob())
    expect(mockedUpdate).toHaveBeenCalledTimes(2)
    expect(savedFrames()).toEqual([SPAWN])
    expect(mockedConsume).toHaveBeenCalledTimes(1)
  })

  it('② 落库成功:帧被确认删除', async () => {
    h.frames = [SPAWN]

    await processor(makeJob())

    expect(mockedConsume).toHaveBeenCalledWith('conv-1', 'msg-1')
    expect(h.deleted).toEqual(['conv-1|msg-1'])
    expect(h.frames).toEqual([])
    expect(savedFrames()).toEqual([SPAWN])
  })

  it('③ 重复处理同一帧:不重复归并落库', async () => {
    h.frames = [SPAWN]
    await processor(makeJob())
    expect(savedFrames()).toEqual([SPAWN])

    // 模拟确认删除失败后的重试:同一帧又被取到,且消息里已带上一轮的帧
    h.frames = [SPAWN]
    mockedFind.mockResolvedValue({ metadata: savedMetadata } as never)
    await processor(makeJob())

    expect(mockedUpdate).toHaveBeenCalledTimes(2)
    expect(savedFrames()).toHaveLength(1)
    expect(savedFrames()).toEqual([SPAWN])
  })

  it('④ 正常路径顺序:取出 → 落库 → 确认', async () => {
    h.frames = [SPAWN]

    await processor(makeJob())

    expect(h.ops).toEqual(['read', 'persist', 'confirm'])
  })
})
