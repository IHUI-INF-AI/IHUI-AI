// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B02 第三切片(2026-10-25):GET /conversations/:id/messages/:messageId/sync-snapshot 回归。
 *
 * 钉五件事(零真 PG;harness 照同目录 chat.test.ts 的 chatRoutes 集成形态,补最小 mock):
 *  ① 鉴权:未认证 ⇒ 401;
 *  ② 参数:非法 messageId(非 uuid)⇒ 400(syncSnapshotParams,不复用放行的裸 z.string());
 *  ③ 归属:会话不存在 ⇒ 404 '对话不存在';属他人 ⇒ 403 '无权访问该对话';
 *     消息不在该会话 ⇒ 404 '消息不存在'(WHERE 谓词一查定案);
 *  ④ 200:data = ChatSyncMessageSnapshot({ code:0, message:'success', data:{...} });
 *     无账行 ⇒ data.rev = 0(created 哨兵);reasoning 空 ⇒ 键省略;
 *  ⑤ 角色封闭集外 ⇒ 409(消息在、但契约面投影失败,不冒 200)。
 */
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)(chat.test.ts 同款)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    COZE_API_KEY: '',
  },
}))

const { mockAuthenticate, convRow, snapshotQueue } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  convRow: { current: null as null | { id: string; userId: string } },
  /** findChatSyncSnapshot 的返回队列(每次调用 shift 一项;空 = 不再 mock ̄\_(ツ)_/¯ 走真实查询桩) */
  snapshotQueue: [] as Array<{ value: unknown }>,
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mockAuthenticate }))
vi.mock('../src/db/chat-queries.js', () => ({
  findConversationById: vi.fn(async () => convRow.current),
}))
vi.mock('../src/db/chat-sync-rev-queries.js', () => ({
  findChatSyncSnapshot: vi.fn(async () => {
    const next = snapshotQueue.shift()
    if (!next) throw new Error('测试桩缺快照用例(findChatSyncSnapshot 队列已空)')
    return next.value
  }),
  allocateChatSyncRev: vi.fn(async () => 1),
}))
vi.mock('../src/db/chat-collab-write-queries.js', () => ({
  readCollabLock: vi.fn(() => null),
  resolveFloorGate: vi.fn(() => 'open'),
}))
vi.mock('@ihui/context-compaction', () => ({
  compressContextIfNeeded: vi.fn(),
  estimateMessagesTokens: vi.fn(() => 0),
}))

import { chatRoutes } from '../src/routes/chat'

const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111'
const OTHER_ID = 'dddddddd-4444-4444-8444-444444444444'
const CONV_ID = 'cccccccc-3333-4333-8333-333333333333'
const MSG_ID = 'bbbbbbbb-2222-4222-8222-222222222222'
const UUID_URL = `/api/chat/conversations/${CONV_ID}/messages/${MSG_ID}/sync-snapshot`

describe('GET /conversations/:id/messages/:messageId/sync-snapshot', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(chatRoutes, { prefix: '/api/chat' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  it('① 未认证 ⇒ 401', async () => {
    const err = Object.assign(new Error('Authentication required'), { statusCode: 401 })
    mockAuthenticate.mockRejectedValueOnce(err)
    const res = await server.inject({ method: 'GET', url: UUID_URL })
    expect(res.statusCode).toBe(401)
  })

  it('② 非法 messageId(非 uuid)⇒ 400', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = USER_ID
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/messages/not-a-uuid/sync-snapshot`,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 400 })
  })

  it('③a 会话不存在 ⇒ 404 对话不存在', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = USER_ID
    })
    convRow.current = null
    const res = await server.inject({ method: 'GET', url: UUID_URL })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: 404, message: '对话不存在' })
  })

  it('③b 会话属他人 ⇒ 403', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = USER_ID
    })
    convRow.current = { id: CONV_ID, userId: OTHER_ID }
    const res = await server.inject({ method: 'GET', url: UUID_URL })
    expect(res.statusCode).toBe(403)
  })

  it('③c 消息不在该会话 ⇒ 404 消息不存在', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = USER_ID
    })
    convRow.current = { id: CONV_ID, userId: USER_ID }
    snapshotQueue.push({ value: null })
    const res = await server.inject({ method: 'GET', url: UUID_URL })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: 404, message: '消息不存在' })
  })

  it('④ 命中:rev=3 + reasoning ⇒ data 形状 = ChatSyncMessageSnapshot', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = USER_ID
    })
    convRow.current = { id: CONV_ID, userId: USER_ID }
    snapshotQueue.push({
      value: {
        conversationId: CONV_ID,
        messageId: MSG_ID,
        role: 'assistant',
        content: '链头内容',
        reasoning: '推理',
        rev: 3,
      },
    })
    const res = await server.inject({ method: 'GET', url: UUID_URL })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: {
        conversationId: CONV_ID,
        messageId: MSG_ID,
        rev: 3,
        role: 'assistant',
        content: '链头内容',
        reasoning: '推理',
      },
    })
  })

  it('④b 无账行 ⇒ rev=0(created 哨兵);reasoning 空 ⇒ 键省略', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = USER_ID
    })
    convRow.current = { id: CONV_ID, userId: USER_ID }
    snapshotQueue.push({
      value: {
        conversationId: CONV_ID,
        messageId: MSG_ID,
        role: 'user',
        content: '初面',
        reasoning: null,
        rev: 0,
      },
    })
    const res = await server.inject({ method: 'GET', url: UUID_URL })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Record<string, unknown> }
    expect(body.data.rev).toBe(0)
    expect('reasoning' in body.data).toBe(false)
  })

  it('⑤ 角色不在契约封闭集 ⇒ 409(不冒 200)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = USER_ID
    })
    convRow.current = { id: CONV_ID, userId: USER_ID }
    snapshotQueue.push({
      value: {
        conversationId: CONV_ID,
        messageId: MSG_ID,
        role: 'tool', // 封闭集 = user/assistant/system
        content: 'x',
        reasoning: null,
        rev: 1,
      },
    })
    const res = await server.inject({ method: 'GET', url: UUID_URL })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ code: 409, message: '消息角色不可同步' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
