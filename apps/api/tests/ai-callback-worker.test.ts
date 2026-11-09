// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

// D24(2026-09-19 立):worker metadata 浅合并语义测试。
// 通过 mock createWorker 捕获 processor,直接驱动 job 处理函数(不连 Redis)。

vi.mock('../src/plugins/queue.js', () => ({
  createWorker: vi.fn(),
  QUEUE_NAMES: { aiCallback: 'aiCallback' },
}))

vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-new' }),
  findMessageById: vi.fn().mockResolvedValue(undefined),
  updateMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
}))

// F-203 口径 B:worker 必须按「真实成本(分)」结算,不是拿 token 当分。
vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: vi.fn(),
}))

vi.mock('../src/plugins/token-balance-service.js', () => ({
  settleWalletUsage: vi.fn(),
}))

import { startAiCallbackWorker } from '../src/workers/ai-callback-worker'
import type { AICallbackJobData } from '../src/plugins/queue.js'
import { createWorker } from '../src/plugins/queue.js'
import { createMessage, findMessageById, updateMessage } from '../src/db/chat-queries.js'
import { resolveAiCost } from '../src/plugins/ai-cost.js'
import { settleWalletUsage } from '../src/plugins/token-balance-service.js'
import type { ChatMessage } from '@ihui/database'

const mockedCreateWorker = vi.mocked(createWorker)
const mockedFind = vi.mocked(findMessageById)
const mockedUpdate = vi.mocked(updateMessage)
const mockedCreate = vi.mocked(createMessage)
const mockedResolveCost = vi.mocked(resolveAiCost)
const mockedSettle = vi.mocked(settleWalletUsage)

function makeServer(): FastifyInstance {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    aiCost: { record: vi.fn().mockResolvedValue({ cost: 0, currency: 'CNY' }) },
    tokenBalance: { deductTokens: vi.fn().mockResolvedValue({ success: true }) },
    pushNotification: vi.fn(),
  } as unknown as FastifyInstance
}

function startWorker(): FastifyInstance {
  mockedCreateWorker.mockClear()
  const server = makeServer()
  startAiCallbackWorker(server)
  return server
}

function getProcessor(): (job: { id?: string; data: AICallbackJobData }) => Promise<unknown> {
  expect(mockedCreateWorker.mock.calls.length).toBeGreaterThan(0)
  return mockedCreateWorker.mock.calls[0]![2] as (job: {
    id?: string
    data: AICallbackJobData
  }) => Promise<unknown>
}

function makeJob(overrides: Partial<AICallbackJobData> = {}): {
  id: string
  data: AICallbackJobData
} {
  const data: AICallbackJobData = {
    conversationId: 'conv-1',
    userId: 'user-1',
    messageId: 'msg-1',
    content: 'AI 回复',
    // tokens 置 0 跳过扣费链路(非本测试焦点)
    tokens: 0,
    metadata: {
      model: 'm1',
      toolCalls: [{ id: 'tc-1', toolName: 'run_command', status: 'success' }],
      terminalTasks: [{ id: 't-1', command: 'ls', status: 'completed' }],
    },
    ...overrides,
  }
  return { id: 'job-1', data }
}

function getUpdateMetadata(): Record<string, unknown> {
  const call = mockedUpdate.mock.calls[0]
  return (call![2] as { metadata: Record<string, unknown> }).metadata
}

/**
 * createMessage / updateMessage 返回行 = ChatMessage。本文件只用到 metadata 与 id,
 * 其余必填列在此给中性默认值(不造只有 id 的半行)。
 */
function messageRow(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'AI 回复',
    createdAt: new Date(0),
    metadata: {},
    tokens: null,
    reasoning: null,
    turnOrdinal: null,
    parentMessageId: null,
    siblingIndex: null,
    pinnedAt: null,
    bookmarkedAt: null,
    ...overrides,
  }
}

describe('AI callback worker metadata merge (D24)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUpdate.mockResolvedValue(messageRow())
    mockedCreate.mockResolvedValue(messageRow({ id: 'msg-new' }))
    mockedFind.mockResolvedValue(undefined)
  })

  it('浅合并:保留 pendingQuestion/questionId 等既有 key,并入 toolCalls/terminalTasks', async () => {
    mockedFind.mockResolvedValue({
      metadata: { pendingQuestion: { question: 'q1' }, questionId: 'qid' },
    } as never)
    startWorker()
    await getProcessor()(makeJob())

    expect(mockedFind).toHaveBeenCalledWith('msg-1')
    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    const meta = getUpdateMetadata()
    expect(meta.pendingQuestion).toEqual({ question: 'q1' })
    expect(meta.questionId).toBe('qid')
    expect(meta.model).toBe('m1')
    expect(meta.toolCalls).toEqual([{ id: 'tc-1', toolName: 'run_command', status: 'success' }])
    expect(meta.terminalTasks).toEqual([{ id: 't-1', command: 'ls', status: 'completed' }])
  })

  it('job 内新值覆盖旧值(同 key 新值优先)', async () => {
    mockedFind.mockResolvedValue({
      metadata: { model: 'old-model', toolCalls: [{ id: 'old' }] },
    } as never)
    startWorker()
    await getProcessor()(makeJob({ metadata: { model: 'new-model', toolCalls: [{ id: 'new' }] } }))

    const meta = getUpdateMetadata()
    expect(meta.model).toBe('new-model')
    expect(meta.toolCalls).toEqual([{ id: 'new' }])
  })

  it('读旧值失败(findMessageById 抛错)降级为整体覆盖,仍正常落库', async () => {
    mockedFind.mockRejectedValue(new Error('db down'))
    startWorker()
    await getProcessor()(makeJob({ metadata: { model: 'm1' } }))

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(getUpdateMetadata()).toEqual({ model: 'm1' })
  })

  it('prev.metadata 为 null/非对象时按无旧值处理', async () => {
    mockedFind.mockResolvedValue({ metadata: null } as never)
    startWorker()
    await getProcessor()(makeJob({ metadata: { model: 'm1' } }))

    expect(getUpdateMetadata()).toEqual({ model: 'm1' })
  })

  it('prev.metadata 为原始类型时按无旧值处理', async () => {
    mockedFind.mockResolvedValue({ metadata: 'string-meta' } as never)
    startWorker()
    await getProcessor()(makeJob({ metadata: { model: 'm1' } }))

    expect(getUpdateMetadata()).toEqual({ model: 'm1' })
  })

  it('无 messageId 走 createMessage 分支,不读旧值,metadata 直接透传', async () => {
    startWorker()
    await getProcessor()(makeJob({ messageId: '' }))

    expect(mockedFind).not.toHaveBeenCalled()
    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'AI 回复',
        metadata: {
          model: 'm1',
          toolCalls: [{ id: 'tc-1', toolName: 'run_command', status: 'success' }],
          terminalTasks: [{ id: 't-1', command: 'ls', status: 'completed' }],
        },
      }),
    )
  })

  it('job 无 metadata 时合并退化为旧值原样保留', async () => {
    mockedFind.mockResolvedValue({
      metadata: { pendingQuestion: { question: 'q1' } },
    } as never)
    startWorker()
    await getProcessor()(makeJob({ metadata: undefined }))

    expect(getUpdateMetadata()).toEqual({ pendingQuestion: { question: 'q1' } })
  })
})

/**
 * F-203 口径 B:异步回调 worker 也必须按真实成本(分)结算。
 * 旧实现把 usage.totalTokens 直接当分扣,成本与 ai_cost_records 两套数必然对不上。
 */
describe('AI callback worker billing (F-203 口径 B)', () => {
  const billingJob = (overrides: Partial<AICallbackJobData> = {}): AICallbackJobData => ({
    conversationId: 'conv-1',
    userId: 'user-1',
    messageId: 'msg-1',
    content: 'AI 回复',
    tokens: 5000,
    model: 'gpt-x',
    provider: 'openai',
    promptTokens: 3000,
    completionTokens: 2000,
    idempotencyKey: 'idem-1',
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockedUpdate.mockResolvedValue(messageRow())
    mockedCreate.mockResolvedValue(messageRow({ id: 'msg-new' }))
    mockedFind.mockResolvedValue(undefined)
    mockedResolveCost.mockResolvedValue({ cost: 48, currency: 'CNY', pricing: null })
    mockedSettle.mockResolvedValue({ deducted: 48, remaining: 952, shortfall: 0 })
  })

  it('按定价折算成本扣 48 分,不是把 5000 token 当 5000 分', async () => {
    const server = startWorker()
    await getProcessor()({
      id: 'job-1',
      data: billingJob(),
    })

    expect(mockedResolveCost).toHaveBeenCalledWith({
      model: 'gpt-x',
      promptTokens: 3000,
      completionTokens: 2000,
    })
    expect(mockedSettle).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 48,
      reason: 'llm_chat:gpt-x',
      idempotencyKey: 'idem-1',
    })
    // 旧链路(deductTokens 按 token 数)不得再被调用
    expect(
      (server.tokenBalance as unknown as { deductTokens: ReturnType<typeof vi.fn> }).deductTokens,
    ).not.toHaveBeenCalled()

    expect(server.aiCost.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        model: 'gpt-x',
        promptTokens: 3000,
        completionTokens: 2000,
        totalTokens: 5000,
        cost: 48,
        currency: 'CNY',
      }),
    )
    const recorded = vi.mocked(server.aiCost.record).mock.calls[0]![0] as { metadata: string }
    expect(JSON.parse(recorded.metadata)).toEqual({
      walletDeductedCents: 48,
      walletBalanceAfterCents: 952,
      billingShortfallCents: 0,
    })
  })

  it('余额不足时扣到 0,欠额落 ai_cost_records.metadata 可审计', async () => {
    mockedSettle.mockResolvedValue({ deducted: 20, remaining: 0, shortfall: 28 })
    const server = startWorker()
    await getProcessor()({ id: 'job-1', data: billingJob() })

    expect(mockedSettle).toHaveBeenCalledWith(expect.objectContaining({ amount: 48 }))
    const recorded = vi.mocked(server.aiCost.record).mock.calls[0]![0] as {
      cost: number
      metadata: string
    }
    expect(recorded.cost).toBe(48)
    expect(JSON.parse(recorded.metadata)).toEqual({
      walletDeductedCents: 20,
      walletBalanceAfterCents: 0,
      billingShortfallCents: 28,
    })
    expect(server.log.warn).toHaveBeenCalled()
  })

  it('缺 model 时无法定价,不扣费也不写成本记录', async () => {
    const server = startWorker()
    await getProcessor()({ id: 'job-1', data: billingJob({ model: undefined }) })

    expect(mockedResolveCost).not.toHaveBeenCalled()
    expect(mockedSettle).not.toHaveBeenCalled()
    expect(server.aiCost.record).not.toHaveBeenCalled()
    expect(server.log.warn).toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
