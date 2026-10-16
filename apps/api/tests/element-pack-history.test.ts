// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

/**
 * D64⑤ 元素包历史落库 —— api 侧守门测试(2026-10-14 立)。
 *
 * 两段:
 * ① 网关捕获:streamToClient 透传路径对 subagent 帧族边转发边收窄落库
 *    (appendElementPackFrame 追加进 chat_element_packs 暂存表);chunk 帧不捕获;
 *    降级流(无 metadata)零捕获。上游 SSE 用内存 ReadableStream 伪造。
 * ② worker 归并:ai-callback 落 assistant 消息前原子取走暂存帧并归并进
 *    metadata.elementPack;空/取走失败 ⇒ 不写 key,消息照常落库。
 *
 * 零 DB 副作用(AGENTS §5):db/queries 全模块 mock,不建连接池。
 * SQL 边界(onConflict 追加/DELETE RETURNING 原子性)只能在有库的机器上判,
 * 见 element-pack-capture.real.test.ts(vitest.real 面,本机探不到 PG ⇒ 未判定)。
 */

const CONV_ID = '11111111-1111-1111-1111-111111111111'
const CLIENT_MSG_ID = '22222222-2222-2222-2222-222222222222'

// ---------------------------------------------------------------------------
// mock 面(与被测模块的导入面一一对应;缺导出 named import 为 undefined)
// ---------------------------------------------------------------------------

const { mockAppendFrame, mockConsumeFrames } = vi.hoisted(() => ({
  mockAppendFrame: vi.fn(async () => true),
  mockConsumeFrames: vi.fn(async (): Promise<Record<string, unknown>[]> => []),
}))

vi.mock('../src/db/element-pack-queries.js', () => ({
  appendElementPackFrame: mockAppendFrame,
  consumeElementPackFrames: mockConsumeFrames,
}))

const { mockUpdateMessage, mockCreateMessage } = vi.hoisted(() => ({
  mockUpdateMessage: vi.fn(),
  mockCreateMessage: vi.fn(),
}))

vi.mock('../src/db/chat-queries.js', () => ({
  bindConversationWorkspace: vi.fn(async () => false),
  createMessage: mockCreateMessage,
  updateMessage: mockUpdateMessage,
  findConversationById: vi.fn(),
  patchConversationMetadata: vi.fn(),
  replaceMessages: vi.fn(),
  setConversationAdditionalDirectories: vi.fn(),
  findMessageById: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (req: { userId?: string }) => {
    req.userId = 'user-1'
  }),
  authenticate: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

vi.mock('../src/utils/semantic-summary.js', () => ({
  generateSemanticSummary: vi.fn(),
  getCachedSemanticSummary: vi.fn(),
  primeSemanticSummary: vi.fn(),
}))

vi.mock('../src/utils/conversation-archive.js', () => ({
  listMessageArchives: vi.fn(),
  findMessageArchive: vi.fn(),
  persistMessageArchive: vi.fn(),
}))

vi.mock('../src/services/repo-wiki-context.js', () => ({ loadRepoWikiContext: vi.fn(async () => null) }))
vi.mock('../src/services/knowledge-chat-context.js', () => ({
  loadKnowledgeContext: vi.fn(async () => null),
}))

const { mockAiServiceFetchStream } = vi.hoisted(() => ({ mockAiServiceFetchStream: vi.fn() }))
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(),
  aiServiceFetchStream: mockAiServiceFetchStream,
}))

// queue:不真建 BullMQ worker,捕获 handler 供测试直调
const { capturedHandler } = vi.hoisted(() => ({
  capturedHandler: { fn: null as null | ((job: { data: Record<string, unknown> }) => Promise<unknown>) },
}))
vi.mock('../src/plugins/queue.js', () => ({
  QUEUE_NAMES: { aiCallback: 'aiCallback' },
  createWorker: vi.fn(
    (
      _server: unknown,
      _queue: string,
      handler: (job: { data: Record<string, unknown> }) => Promise<unknown>,
    ) => {
      capturedHandler.fn = handler
      return { on: vi.fn(), close: vi.fn() }
    },
  ),
}))

// ---------------------------------------------------------------------------
// ① 网关捕获
// ---------------------------------------------------------------------------

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'

function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const payload = lines.map((l) => `data: ${l}\n\n`).join('')
  const bytes = new TextEncoder().encode(payload)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

const STREAM_LINES = [
  JSON.stringify({ type: 'chunk', content: '开工' }),
  JSON.stringify({ type: 'subagent_spawn', id: 'sa1', role: 'researcher', task: '查资料' }),
  JSON.stringify({
    type: 'subagent_progress',
    id: 'sa1',
    phase: 'tool_call',
    tool: 'web_search',
    iteration: 1,
  }),
  JSON.stringify({ type: 'subagent_end', id: 'sa1', status: 'done' }),
  JSON.stringify({ type: 'done', usage: { total_tokens: 5 } }),
]

describe('D64⑤ 网关元素包捕获(POST /chat/stream)', () => {
  let server: Awaited<ReturnType<typeof Fastify>>
  beforeAll(async () => {
    const app = Fastify()
    await app.register(aiChatStreamRoutes)
    await app.ready()
    server = app
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('subagent 三帧逐帧收窄落暂存表;chunk 帧不捕获', async () => {
    mockAiServiceFetchStream.mockResolvedValueOnce({ ok: true, body: sseBody(STREAM_LINES) })
    await server.inject({
      method: 'POST',
      url: '/chat/stream',
      payload: {
        messages: [{ role: 'user', content: '跑个子代理' }],
        metadata: { conversationId: CONV_ID, messageId: CLIENT_MSG_ID, userId: 'user-1' },
      },
    })
    // 给 fire-and-forget append 留一拍微任务
    await new Promise((r) => setTimeout(r, 10))
    expect(mockAppendFrame).toHaveBeenCalledTimes(3)
    expect(mockAppendFrame).toHaveBeenNthCalledWith(1, CONV_ID, CLIENT_MSG_ID, {
      kind: 'subagent_spawn',
      id: 'sa1',
      role: 'researcher',
      task: '查资料',
      timestamp: expect.any(String),
    })
    expect(mockAppendFrame).toHaveBeenNthCalledWith(2, CONV_ID, CLIENT_MSG_ID, {
      kind: 'subagent_progress',
      id: 'sa1',
      phase: 'tool_call',
      tool: 'web_search',
      iteration: 1,
      timestamp: expect.any(String),
    })
    expect(mockAppendFrame).toHaveBeenNthCalledWith(3, CONV_ID, CLIENT_MSG_ID, {
      kind: 'subagent_end',
      id: 'sa1',
      status: 'done',
      timestamp: expect.any(String),
    })
  })

  it('降级流(无 metadata ⇒ 无 replayKey)零捕获,流正常 200', async () => {
    mockAiServiceFetchStream.mockResolvedValueOnce({ ok: true, body: sseBody(STREAM_LINES) })
    const res = await server.inject({
      method: 'POST',
      url: '/chat/stream',
      payload: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(200)
    await new Promise((r) => setTimeout(r, 10))
    expect(mockAppendFrame).not.toHaveBeenCalled()
  })

  it('表外帧形(缺 id 的 subagent_*)被收窄丢弃,不落暂存', async () => {
    mockAiServiceFetchStream.mockResolvedValueOnce({
      ok: true,
      body: sseBody([JSON.stringify({ type: 'subagent_spawn' })]),
    })
    await server.inject({
      method: 'POST',
      url: '/chat/stream',
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        metadata: { conversationId: CONV_ID, messageId: CLIENT_MSG_ID },
      },
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(mockAppendFrame).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ② worker 归并
// ---------------------------------------------------------------------------

const SPAWN_FRAME = {
  kind: 'subagent_spawn',
  id: 'sa1',
  role: 'researcher',
  task: '查资料',
  timestamp: '2026-10-14T00:00:00.000Z',
}
const END_FRAME = {
  kind: 'subagent_end',
  id: 'sa1',
  status: 'done',
  timestamp: '2026-10-14T00:00:01.000Z',
}

function fakeServer(): Record<string, unknown> {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    aiCost: { record: vi.fn(async () => ({})) },
    tokenBalance: { deductTokens: vi.fn(async () => ({ success: true })) },
    pushNotification: vi.fn(),
  }
}

describe('D64⑤ worker 元素包归并(aiCallback job)', () => {
  beforeEach(async () => {
    // startAiCallbackWorker 经 createWorker(已被 mock)把 handler 捕获进 capturedHandler
    if (capturedHandler.fn === null) {
      const { startAiCallbackWorker } = await import('../src/workers/ai-callback-worker.js')
      startAiCallbackWorker(fakeServer() as never)
    }
    expect(capturedHandler.fn).not.toBeNull()
  })
  afterEach(() => {
    vi.clearAllMocks()
    mockConsumeFrames.mockReset()
    mockConsumeFrames.mockResolvedValue([])
  })

  it('取走帧非空 ⇒ metadata.elementPack.frames 并入 update 路径,prevMeta 保留', async () => {
    mockUpdateMessage.mockResolvedValueOnce({ id: 'db-1' })
    mockConsumeFrames.mockResolvedValueOnce([SPAWN_FRAME, END_FRAME])

    await capturedHandler.fn!({
      data: {
        conversationId: CONV_ID,
        userId: 'user-1',
        messageId: CLIENT_MSG_ID,
        content: '回答',
        tokens: 5,
        metadata: { model: 'gpt-x' },
      },
    })

    expect(mockConsumeFrames).toHaveBeenCalledWith(CONV_ID, CLIENT_MSG_ID)
    expect(mockUpdateMessage).toHaveBeenCalledTimes(1)
    const patch = mockUpdateMessage.mock.calls[0]![2] as {
      metadata: Record<string, unknown>
    }
    expect((patch.metadata.elementPack as { frames: unknown[] }).frames).toEqual([
      SPAWN_FRAME,
      END_FRAME,
    ])
    expect(patch.metadata.model).toBe('gpt-x')
  })

  it('update 失败回退 createMessage ⇒ 元素包随创建一次性落库', async () => {
    mockUpdateMessage.mockRejectedValueOnce(new Error('消息不存在'))
    mockCreateMessage.mockResolvedValueOnce({ id: 'db-2' })
    mockConsumeFrames.mockResolvedValueOnce([SPAWN_FRAME])

    await capturedHandler.fn!({
      data: {
        conversationId: CONV_ID,
        userId: 'user-1',
        messageId: CLIENT_MSG_ID,
        content: '回答',
        tokens: 0,
        metadata: undefined,
      },
    })

    expect(mockCreateMessage).toHaveBeenCalledTimes(1)
    const input = mockCreateMessage.mock.calls[0]![0] as {
      metadata: Record<string, unknown>
    }
    expect((input.metadata.elementPack as { frames: unknown[] }).frames).toEqual([SPAWN_FRAME])
  })

  it('暂存为空 ⇒ metadata 不写 elementPack 键(与"无元素包"同形,不落冗余)', async () => {
    mockUpdateMessage.mockResolvedValueOnce({ id: 'db-3' })

    await capturedHandler.fn!({
      data: {
        conversationId: CONV_ID,
        userId: 'user-1',
        messageId: CLIENT_MSG_ID,
        content: '回答',
        tokens: 0,
        metadata: {},
      },
    })

    const patch = mockUpdateMessage.mock.calls[0]![2] as { metadata: Record<string, unknown> }
    expect(patch.metadata.elementPack).toBeUndefined()
  })

  it('取走失败(DB 抖动)⇒ 只 warn,消息照常落库', async () => {
    mockUpdateMessage.mockResolvedValueOnce({ id: 'db-4' })
    mockConsumeFrames.mockRejectedValueOnce(new Error('db down'))

    await capturedHandler.fn!({
      data: {
        conversationId: CONV_ID,
        userId: 'user-1',
        messageId: CLIENT_MSG_ID,
        content: '回答',
        tokens: 0,
        metadata: {},
      },
    })

    expect(mockUpdateMessage).toHaveBeenCalledTimes(1)
    const patch = mockUpdateMessage.mock.calls[0]![2] as { metadata: Record<string, unknown> }
    expect(patch.metadata.elementPack).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
