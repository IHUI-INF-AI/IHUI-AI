// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// queueItems 回调落库链测试(D33① 下半段,2026-09-26 立)。
// 覆盖面:ai-callback 白名单三处(schema 校验 → 解构 → metadata 构造点)+ worker 浅合并,
// 即"字段能不能穿到读回"的两段真实链路。形状唯一真相源 =
// apps/ai-service/app/core/queue_items.py(QUEUE_ITEM_FIELDS = id / text / createdAt)。

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8803',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    AI_CALLBACK_SECRET: 'test-secret',
  },
}))

vi.mock('../src/db/chat-queries.js', () => ({
  // 路由侧只用到 findConversationById(G-165 权限档盖章)
  findConversationById: vi.fn().mockResolvedValue(null),
  // worker 侧用到这三枚(D24 浅合并落库)
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-new' }),
  findMessageById: vi.fn().mockResolvedValue(undefined),
  updateMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
}))

vi.mock('../src/plugins/queue.js', () => ({
  createWorker: vi.fn(),
  QUEUE_NAMES: { aiCallback: 'aiCallback' },
}))

import aiCallbackRoutes from '../src/routes/ai-callback'
import { startAiCallbackWorker } from '../src/workers/ai-callback-worker'
import { createWorker } from '../src/plugins/queue.js'
import type { AICallbackJobData } from '../src/plugins/queue.js'
import { findMessageById, updateMessage } from '../src/db/chat-queries.js'

const mockedFindMessageById = vi.mocked(findMessageById)
const mockedUpdateMessage = vi.mocked(updateMessage)
const mockedCreateWorker = vi.mocked(createWorker)

/** 队列项的落库形状(与 Python 侧 QueueItemPayload 逐字段同形) */
interface QueueItem {
  id: string
  text: string
  createdAt: number
}

const item = (index: number, text = `排队消息 ${index}`): QueueItem => ({
  id: `q_${index}`,
  text,
  createdAt: 1_790_000_000_000 + index,
})

/**
 * 走一次真实回调,回传状态码与**入队 payload 里的 metadata**(即落库前的最后一份形态)。
 * 队列不可用时(校验 400 / 缺关联键)metadata 为 undefined。
 */
async function postCallback(
  body: Record<string, unknown>,
): Promise<{ status: number; metadata: Record<string, unknown> | undefined }> {
  const server = Fastify({ logger: false })
  const add = vi.fn().mockResolvedValue({ id: 'job-1' })
  server.decorate('aiCallbackQueue', { add })
  await server.register(aiCallbackRoutes)
  await server.ready()

  const res = await server.inject({
    method: 'POST',
    url: '/api/ai/callback',
    headers: { 'x-internal-secret': 'test-secret' },
    payload: {
      content: 'AI 回复',
      metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
      ...body,
    },
  })
  await server.close()

  const jobData = add.mock.calls[0]?.[1] as { metadata?: Record<string, unknown> } | undefined
  return { status: res.statusCode, metadata: jobData?.metadata }
}

describe('ai-callback queueItems 白名单(D33① 下半段)', () => {
  it('带 queueItems 时并入入队 metadata,三键逐字段原样承接', async () => {
    const queueItems = [item(1), item(2)]
    const { status, metadata } = await postCallback({ queueItems })

    expect(status).toBe(202)
    expect(metadata).toBeDefined()
    expect(metadata?.queueItems).toEqual(queueItems)
  })

  // 本票的核心语义:空数组 ≠ 缺键。上一条按"非空才写 key"的既有约定会把这两种状态压成
  // 同一种,排队项恰好要靠这一区分(读取侧要能判定"确实没有排队消息"与"这版后端没送")。
  it('空数组写入 key(= 这轮确实没有排队消息)', async () => {
    const { status, metadata } = await postCallback({ queueItems: [] })

    expect(status).toBe(202)
    expect(metadata).toHaveProperty('queueItems')
    expect(metadata?.queueItems).toEqual([])
  })

  it('缺键时不写 queueItems(= 这版后端没有该字段,读回侧不得当成"无排队")', async () => {
    const { status, metadata } = await postCallback({})

    expect(status).toBe(202)
    expect(metadata).toBeDefined()
    expect(metadata).not.toHaveProperty('queueItems')
  })

  it('元素含未知字段一律 400(strict 拒绝,绝不透传进 metadata)', async () => {
    const { status, metadata } = await postCallback({
      queueItems: [
        {
          id: 'q_1',
          text: '带附件的排队消息',
          createdAt: 1_790_000_000_000,
          // 上游响应体/附件正文这类键不得进库(§5 显式列举)
          attachments: [{ data: 'data:image/png;base64,AAAA' }],
        },
      ],
    })

    expect(status).toBe(400)
    expect(metadata).toBeUndefined()
  })

  it.each([
    ['缺 id', { text: 't', createdAt: 1_790_000_000_000 }],
    ['缺 text', { id: 'q_1', createdAt: 1_790_000_000_000 }],
    ['缺 createdAt', { id: 'q_1', text: 't' }],
    ['createdAt 非整数(归一为毫秒是 Python 侧职责)', { id: 'q_1', text: 't', createdAt: 'x' }],
    ['id 空串', { id: '', text: 't', createdAt: 1_790_000_000_000 }],
    ['text 非字符串', { id: 'q_1', text: 42, createdAt: 1_790_000_000_000 }],
  ])('元素 %s 时整轮返回 400', async (_label: string, bad: Record<string, unknown>) => {
    const { status } = await postCallback({ queueItems: [bad] })
    expect(status).toBe(400)
  })

  it('超过 8 项 → 按队首截断到 MAX,不拒回调(拒回调等于助手消息不落库)', async () => {
    const queueItems = Array.from({ length: 11 }, (_, i) => item(i + 1))
    const { status, metadata } = await postCallback({ queueItems })

    expect(status).toBe(202)
    const persisted = metadata?.queueItems as QueueItem[]
    expect(persisted).toHaveLength(8)
    // 保队首:队尾 3 项(q_9..q_11)被丢弃,前 8 项逐字段不变
    expect(persisted.map((row) => row.id)).toEqual(
      Array.from({ length: 8 }, (_, i) => `q_${i + 1}`),
    )
    expect(persisted[0]).toEqual(queueItems[0])
  })

  it('text 超 2000 字符 → api 侧再截一次,标注与 Python 侧 _truncate_persist_value 同形', async () => {
    const long = '啊'.repeat(2500)
    const { status, metadata } = await postCallback({ queueItems: [item(1, long)] })

    expect(status).toBe(202)
    const persisted = metadata?.queueItems as QueueItem[]
    expect(persisted[0].text).toBe(`${'啊'.repeat(2000)}...[truncated 500 chars]`)
    expect(persisted[0].id).toBe('q_1')
    expect(persisted[0].createdAt).toBe(1_790_000_000_001)
  })

  it('text 恰在 2000 字符内原样保留(不误伤正常长度)', async () => {
    const exact = 'x'.repeat(2000)
    const { metadata } = await postCallback({ queueItems: [item(1, exact)] })
    const persisted = metadata?.queueItems as QueueItem[]
    expect(persisted[0].text).toBe(exact)
  })
})

describe('queueItems 穿过 worker 浅合并落库(D33① 读回链)', () => {
  function makeServer(): FastifyInstance {
    return {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      aiCost: { record: vi.fn().mockResolvedValue(undefined) },
      tokenBalance: { deductTokens: vi.fn().mockResolvedValue({ success: true }) },
      pushNotification: vi.fn(),
    } as unknown as FastifyInstance
  }

  function processor(): (job: { id?: string; data: AICallbackJobData }) => Promise<unknown> {
    mockedCreateWorker.mockClear()
    startAiCallbackWorker(makeServer())
    expect(mockedCreateWorker.mock.calls.length).toBeGreaterThan(0)
    return mockedCreateWorker.mock.calls[0][2] as (job: {
      id?: string
      data: AICallbackJobData
    }) => Promise<unknown>
  }

  function mergedMetadata(): Record<string, unknown> {
    const call = mockedUpdateMessage.mock.calls[0]
    return (call[2] as { metadata: Record<string, unknown> }).metadata
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedUpdateMessage.mockResolvedValue({ id: 'msg-1' })
    mockedFindMessageById.mockResolvedValue(undefined)
  })

  it('入队 metadata.queueItems 原样并入 updateMessage 的 jsonb(无枚举式丢字段)', async () => {
    mockedFindMessageById.mockResolvedValue({ metadata: { pendingQuestion: { question: 'q' } } })
    const queueItems = [item(1), item(2)]

    await processor()({
      id: 'job-1',
      data: {
        conversationId: 'conv-1',
        userId: 'user-1',
        messageId: 'msg-1',
        content: 'AI 回复',
        tokens: 0,
        metadata: { model: 'm1', queueItems },
      },
    })

    const meta = mergedMetadata()
    expect(meta.queueItems).toEqual(queueItems)
    // 浅合并不得吃掉既有 key(提问挂起态与排队项共存是真实场景)
    expect(meta.pendingQuestion).toEqual({ question: 'q' })
  })

  it('本轮空数组覆盖上一轮的非空残留(空数组语义真的落库)', async () => {
    mockedFindMessageById.mockResolvedValue({
      metadata: { queueItems: [item(9, '上一轮还在排队的消息')] },
    })

    await processor()({
      id: 'job-2',
      data: {
        conversationId: 'conv-1',
        userId: 'user-1',
        messageId: 'msg-1',
        content: 'AI 回复',
        tokens: 0,
        metadata: { queueItems: [] },
      },
    })

    expect(mergedMetadata().queueItems).toEqual([])
  })

  it('本轮缺键时不动上一轮的值(读回侧据此区分"后端没送")', async () => {
    const prev = [item(9, '上一轮还在排队的消息')]
    mockedFindMessageById.mockResolvedValue({ metadata: { queueItems: prev } })

    await processor()({
      id: 'job-3',
      data: {
        conversationId: 'conv-1',
        userId: 'user-1',
        messageId: 'msg-1',
        content: 'AI 回复',
        tokens: 0,
        metadata: { model: 'm1' },
      },
    })

    expect(mergedMetadata().queueItems).toEqual(prev)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
