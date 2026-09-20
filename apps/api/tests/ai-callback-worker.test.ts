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

import { startAiCallbackWorker } from '../src/workers/ai-callback-worker'
import type { AICallbackJobData } from '../src/plugins/queue.js'
import { createWorker } from '../src/plugins/queue.js'
import { createMessage, findMessageById, updateMessage } from '../src/db/chat-queries.js'

const mockedCreateWorker = vi.mocked(createWorker)
const mockedFind = vi.mocked(findMessageById)
const mockedUpdate = vi.mocked(updateMessage)
const mockedCreate = vi.mocked(createMessage)

function makeServer(): FastifyInstance {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    aiCost: { record: vi.fn().mockResolvedValue(undefined) },
    tokenBalance: { deductTokens: vi.fn().mockResolvedValue({ success: true }) },
    pushNotification: vi.fn(),
  } as unknown as FastifyInstance
}

function startWorker(): void {
  mockedCreateWorker.mockClear()
  startAiCallbackWorker(makeServer())
}

function getProcessor(): (job: { id?: string; data: AICallbackJobData }) => Promise<unknown> {
  expect(mockedCreateWorker.mock.calls.length).toBeGreaterThan(0)
  return mockedCreateWorker.mock.calls[0][2] as (job: {
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
  return (call[2] as { metadata: Record<string, unknown> }).metadata
}

describe('AI callback worker metadata merge (D24)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUpdate.mockResolvedValue({ id: 'msg-1' })
    mockedCreate.mockResolvedValue({ id: 'msg-new' })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
