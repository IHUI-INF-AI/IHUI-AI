// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D153(2026-09-29 立)会话元数据变更的 per-user 广播**生产面**回归。
 * 权威口径:`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` §11.3 + §十 D153 第 3/6 栏。
 * 不连库(mock db 与 mock chat-queries,风格与 silent-distortion-batch-and-broadcast.test.ts 一致)。
 *
 * 钉住的四格,每格对应一个"账面绿而用户看不见"的失效:
 *  A 写库成功后必须发帧,且帧里**带着新值**(`values`)。
 *    只发 `{fields:['title']}` 而不带值,另一端要么再 GET 一次(直接违反票第 6 栏验收①
 *    的"不发 HTTP 请求即更新"),要么停在旧值(就是原缺陷本身)。
 *  B `fields` 按**落库前后的差集**算,不照抄请求体键名:写回同一个标题 ⇒ 一帧都不发。
 *    发了就是给发起端自己弹一条"其他设备改过"的假提示(第 3 栏冲突语义的反面)。
 *  C 归档/取消归档(单条与批量)必须发帧,批量只对**库里真被命中**的那些 id 发。
 *    归档是沉默分叉最重的一型:另一端侧栏里那行还在,点开才发现已归档。
 *  D 广播抛错**不得**把 200 变成 500(写库已成功;"下行没到"伪装成"写库失败"会把排查
 *    方向整个指错),同时不得静默(§5e「失败必须响」)。
 *
 * 反向对照(票第 6 栏验收②)不在本文件里做 —— 它要求真的把 chat.ts 的发射调用注掉再跑本文件,
 * 用例 A 必红;那一次的运行与退出码记在交付报告,不在测试代码里伪装成"自己注掉自己"。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { parseUserBroadcastFrame, type ConversationUpdatedEvent } from '@ihui/types'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken, mockOwnedRows, mockFindConversationById, mockUpdateConversation } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockOwnedRows: vi.fn((): { id: string }[] => []),
  mockFindConversationById: vi.fn(async (): unknown => null),
  mockUpdateConversation: vi.fn(async (): unknown => null),
}))

vi.mock('@ihui/auth', () => ({ verifyAccessToken: mockVerifyAccessToken }))
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/index.js', () => {
  const chain = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'values', 'returning', 'set']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void) => resolve(mockOwnedRows())
    return step
  }
  return {
    db: {
      select: vi.fn(() => chain()),
      insert: vi.fn(() => chain()),
      update: vi.fn(() => chain()),
      delete: vi.fn(() => chain()),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => chain()) },
  }
})

/** 会话行的最小完整形状(serializeConversation 读的键都在这里,缺一个就是 500 而不是判据红) */
function row(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const now = new Date('2026-09-29T08:00:00.000Z')
  return {
    id: CONV_ID,
    userId: USER_A,
    title: '新对话',
    model: 'gpt-4o',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    compressedAt: null,
    compressedContext: null,
    pinned: false,
    pinnedAt: null,
    ...over,
  }
}

vi.mock('../src/db/chat-queries.js', () => ({
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  findConversationById: mockFindConversationById,
  updateConversation: mockUpdateConversation,
  deleteConversation: vi.fn(),
  deleteConversationsBatch: vi.fn(async () => 0),
  favoriteConversationsBatch: vi.fn(async () => 0),
  unfavoriteConversationsBatch: vi.fn(async () => 0),
  setConversationsArchivedBatch: vi.fn(async () => 0),
  findMessages: vi.fn(),
  createMessage: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(async () => row({ archivedAt: new Date('2026-09-29T09:00:00.000Z') })),
  unarchiveConversation: vi.fn(async () => row({ archivedAt: null })),
  findMessagesForExport: vi.fn(),
  findMessagesForShare: vi.fn(),
  saveCompressedContext: vi.fn(),
  setConversationShareToken: vi.fn(),
  findConversationByShareToken: vi.fn(),
  regenerateConversationMessages: vi.fn(),
  branchConversationFrom: vi.fn(),
}))

import { chatRoutes } from '../src/routes/chat.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const CONV_ID = '11111111-1111-4111-8111-111111111111'
const ID_2 = '22222222-2222-4222-8222-222222222222'
const ID_3 = '33333333-3333-4333-8333-333333333333'

/**
 * 把真实插件装饰出的 broadcastToUser 换成可观测的 spy:
 * 断言的是**路由发给谁、发了什么**,不是 spy 自己编的形状。
 * broadcastThrows=true 用来验判据 D(广播失败不得改响应)。
 */
let emitted: Array<{ userId: string; event: string; data: unknown }> = []
let broadcastThrows = false

async function buildChatApp(): Promise<FastifyInstance> {
  mockVerifyAccessToken.mockResolvedValue({
    userId: USER_A,
    phone: '13800000000',
    familyId: USER_A,
    roleId: 1,
  })
  emitted = []
  broadcastThrows = false
  const app = Fastify({ logger: false })
  app.decorate('broadcastToUser', (userId: string, event: string, data: unknown) => {
    if (broadcastThrows) throw new Error('socket is closed')
    emitted.push({ userId, event, data })
  })
  await app.register(chatRoutes, { prefix: '/api/chat' })
  await app.ready()
  return app
}

/** 只认能被 @ihui/types 那份联合解出来的帧 ⇒ "发出去了但另一端认不下" 一律算没发 */
function parsedFrames(): ConversationUpdatedEvent[] {
  const out: ConversationUpdatedEvent[] = []
  for (const e of emitted) {
    const evt = parseUserBroadcastFrame({ event: e.event, data: e.data })
    if (evt) out.push(evt)
  }
  return out
}

describe('D153-A 改名:写库成功后必须发一帧带新值的广播', () => {
  beforeEach(() => {
    mockOwnedRows.mockReturnValue([])
  })

  it('PATCH title ⇒ 恰一帧、发给本人、fields=[title]、values 带新值、at 可解析', async () => {
    mockFindConversationById.mockResolvedValue(row({ title: '新对话' }))
    mockUpdateConversation.mockResolvedValue(
      row({ title: '改后的名字', updatedAt: new Date('2026-09-29T10:00:00.000Z') }),
    )
    const app = await buildChatApp()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      payload: { title: '改后的名字' },
      headers: { authorization: 'Bearer mock-user-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(emitted).toHaveLength(1)
    const [frame] = parsedFrames()
    expect(frame, '发出去的帧必须能被 @ihui/types 的联合解出').toBeDefined()
    expect(frame?.event).toBe('conversation:updated')
    expect(frame?.data.conversationId).toBe(CONV_ID)
    expect(frame?.data.changedBy).toBe(USER_A)
    expect(frame?.data.fields).toEqual(['title'])
    // 验收① 的前提:帧里带得上新值,另一端才谈"不发 HTTP 就更新"。
    // `values` 只带 fields 里那几个键(唯一出口按 fields 取子集)—— 多带的键无人应用,
    // 少带就退回"另一端要么 GET 要么停在旧值"。
    expect(frame?.data.values).toEqual({ title: '改后的名字' })
    expect(Number.isNaN(Date.parse(frame?.data.at ?? ''))).toBe(false)
    await app.close()
  })

  it('换模型 ⇒ fields=[model] 且 values.model 是新模型(头部徽章靠它,不 GET)', async () => {
    mockFindConversationById.mockResolvedValue(row({ model: 'gpt-4o' }))
    mockUpdateConversation.mockResolvedValue(row({ model: 'claude-sonnet-4' }))
    const app = await buildChatApp()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      payload: { model: 'claude-sonnet-4' },
      headers: { authorization: 'Bearer mock-user-token' },
    })
    expect(res.statusCode).toBe(200)
    const [frame] = parsedFrames()
    expect(frame?.data.fields).toEqual(['model'])
    expect(frame?.data.values?.model).toBe('claude-sonnet-4')
    await app.close()
  })
})

describe('D153-B fields 按落库差集算,不照抄请求体键名', () => {
  it('写回与库里相同的标题 ⇒ 一帧都不发(否则发起端给自己弹"其他设备改过")', async () => {
    mockFindConversationById.mockResolvedValue(row({ title: '本来就是这句' }))
    mockUpdateConversation.mockResolvedValue(row({ title: '本来就是这句' }))
    const app = await buildChatApp()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      payload: { title: '本来就是这句' },
      headers: { authorization: 'Bearer mock-user-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(emitted).toHaveLength(0)
    await app.close()
  })

  it('只改 systemPrompt(不在可同步字段集里)⇒ 同样不发帧', async () => {
    mockFindConversationById.mockResolvedValue(row())
    mockUpdateConversation.mockResolvedValue(row({ systemPrompt: '改了提示词' }))
    const app = await buildChatApp()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      payload: { systemPrompt: '改了提示词' },
      headers: { authorization: 'Bearer mock-user-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(emitted).toHaveLength(0)
    await app.close()
  })
})

describe('D153-C 归档:单条与批量都必须发,批量只对库里命中的 id 发', () => {
  it('POST /archive ⇒ 一帧 fields=[archive] values.archive=true', async () => {
    mockFindConversationById.mockResolvedValue(row({ archivedAt: null }))
    const app = await buildChatApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/archive`,
      headers: { authorization: 'Bearer mock-user-token' },
    })
    expect(res.statusCode).toBe(200)
    const [frame] = parsedFrames()
    expect(frame?.data.fields).toEqual(['archive'])
    expect(frame?.data.values?.archive).toBe(true)
    await app.close()
  })

  it('DELETE /archive ⇒ 一帧 values.archive=false(取消归档同样是沉默变更)', async () => {
    mockFindConversationById.mockResolvedValue(row({ archivedAt: new Date() }))
    const app = await buildChatApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/chat/conversations/${CONV_ID}/archive`,
      headers: { authorization: 'Bearer mock-user-token' },
    })
    expect(res.statusCode).toBe(200)
    const [frame] = parsedFrames()
    expect(frame?.data.values?.archive).toBe(false)
    await app.close()
  })

  it('批量归档 3 个而库里只命中 2 个 ⇒ 恰两帧,别人的/写错的 id 一条都不推', async () => {
    mockOwnedRows.mockReturnValue([{ id: CONV_ID }, { id: ID_2 }])
    const app = await buildChatApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/batch',
      payload: { action: 'archive', ids: [CONV_ID, ID_2, ID_3] },
      headers: { authorization: 'Bearer mock-user-token' },
    })
    expect(res.statusCode).toBe(200)
    const ids = parsedFrames().map((f) => f.data.conversationId)
    expect(ids.sort()).toEqual([CONV_ID, ID_2].sort())
    // 未命中的那个 id 绝不能出现在广播里(回报集合取库侧确认集,不取请求侧数组)
    expect(ids).not.toContain(ID_3)
    await app.close()
  })
})

describe('D153-D 广播失败不得改响应,也不得静默', () => {
  it('broadcastToUser 抛出 ⇒ 仍然 200 且响应体形状不变(写库已成功)', async () => {
    mockFindConversationById.mockResolvedValue(row({ title: '旧' }))
    mockUpdateConversation.mockResolvedValue(row({ title: '新' }))
    const app = await buildChatApp()
    broadcastThrows = true
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      payload: { title: '新' },
      headers: { authorization: 'Bearer mock-user-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.conversation.title).toBe('新')
    expect(emitted).toHaveLength(0)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
