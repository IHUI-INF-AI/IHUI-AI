// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 两格「静默失真」离线回归(2026-09-26 立,不连库:mock db 与 mock socket)。
 *
 * 格① POST /api/chat/conversations/batch —— "改了 0 行"与"改成功"同形
 *   ① 传 3 个 id、库中只命中 1 个 ⇒ 响应逐条点名未命中的 2 个,且不再只有既有字段
 *   ② 全命中 ⇒ 新字段为空数组,既有字段(action/affected)逐字不变(等价回归)
 *   ④ 判别力:②就是①的控制组 —— missedIds 只能由那次归属预查询算出,
 *      对账一旦被摘掉,①必红(undefined ≠ ['id2','id3']),②也会红(undefined ≠ [])
 *
 * 格② ws-broadcast 的 send 失败 —— 丢帧且无人知
 *   ③ 发送失败 ⇒ 主流程继续(同批次健康连接照样收到帧)+ 计数 +1 + 首次 warn 恰一次,
 *      第二次不重复喊;并覆盖两条失败路径(同步抛出 / ws 的 callback 报错)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// ── 格① 所需 mocks(风格与 src/routes/__tests__/conversation-archive.test.ts 一致)──
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

const { mockVerifyAccessToken, mockOwnedRows, mockArchivedBatch } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  /** 归属预查询(chat.ts 新增的那次 select)返回值,由每个用例现设 */
  mockOwnedRows: vi.fn((): { id: string }[] => []),
  mockArchivedBatch: vi.fn(async (): Promise<number> => 0),
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

vi.mock('../src/db/chat-queries.js', () => ({
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  findConversationById: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversationsBatch: vi.fn(async () => 0),
  favoriteConversationsBatch: vi.fn(async () => 0),
  unfavoriteConversationsBatch: vi.fn(async () => 0),
  setConversationsArchivedBatch: mockArchivedBatch,
  findMessages: vi.fn(),
  createMessage: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
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
const ID_1 = '11111111-1111-4111-8111-111111111111'
const ID_2 = '22222222-2222-4222-8222-222222222222'
const ID_3 = '33333333-3333-4333-8333-333333333333'

async function buildChatApp(): Promise<FastifyInstance> {
  mockVerifyAccessToken.mockResolvedValue({
    userId: USER_A,
    phone: '13800000000',
    familyId: USER_A,
    roleId: 1,
  })
  const app = Fastify()
  await app.register(chatRoutes, { prefix: '/api/chat' })
  await app.ready()
  return app
}

describe('格① 批量归档/收藏/删除:未命中的 id 必须点名', () => {
  beforeEach(() => {
    mockOwnedRows.mockReturnValue([])
    mockArchivedBatch.mockResolvedValue(0)
  })

  it('① 传 3 个 id 而库里只有 1 个属于本人 ⇒ 点名未命中的 2 个,且不再是纯 success 形状', async () => {
    mockOwnedRows.mockReturnValue([{ id: ID_1 }])
    mockArchivedBatch.mockResolvedValue(1)
    const app = await buildChatApp()

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/batch',
      payload: { action: 'archive', ids: [ID_1, ID_2, ID_3] },
      headers: { authorization: 'Bearer mock-user-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    // 新字段逐条点名未命中(顺序与请求一致)
    expect(body.data.missedIds).toEqual([ID_2, ID_3])
    // 既有字段语义不变
    expect(body.data.action).toBe('archive')
    expect(body.data.affected).toBe(1)
    // "不再只是纯 success 形状":同一份 code:0 里必须带得上未命中信息
    expect(body.data).toHaveProperty('missedIds')
    await app.close()
  })

  it('② 全命中 ⇒ missedIds 为空数组,既有字段逐字不变(等价回归)', async () => {
    mockOwnedRows.mockReturnValue([{ id: ID_1 }, { id: ID_2 }, { id: ID_3 }])
    mockArchivedBatch.mockResolvedValue(3)
    const app = await buildChatApp()

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/batch',
      payload: { action: 'archive', ids: [ID_1, ID_2, ID_3] },
      headers: { authorization: 'Bearer mock-user-token' },
    })

    const body = res.json()
    expect(res.statusCode).toBe(200)
    expect(body.data.missedIds).toEqual([])
    // 整包形态:只多一个键,其余与改前逐字相同
    expect(body).toEqual({
      code: 0,
      message: 'success',
      data: { action: 'archive', affected: 3, missedIds: [] },
    })
    await app.close()
  })

  it('①b 一个都没命中(全是别人的 id)⇒ 点名全部,affected 仍如实为 0', async () => {
    mockOwnedRows.mockReturnValue([])
    mockArchivedBatch.mockResolvedValue(0)
    const app = await buildChatApp()

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/batch',
      payload: { action: 'favorite', ids: [ID_1, ID_2] },
      headers: { authorization: 'Bearer mock-user-token' },
    })

    const body = res.json()
    expect(body.data.affected).toBe(0)
    expect(body.data.missedIds).toEqual([ID_1, ID_2])
    await app.close()
  })

  it('重复 id 不重复计账(去重后逐条判归属)', async () => {
    mockOwnedRows.mockReturnValue([{ id: ID_1 }])
    mockArchivedBatch.mockResolvedValue(1)
    const app = await buildChatApp()

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/batch',
      payload: { action: 'unarchive', ids: [ID_1, ID_1] },
      headers: { authorization: 'Bearer mock-user-token' },
    })

    expect(res.json().data.missedIds).toEqual([])
    await app.close()
  })
})

// ── 格② 所需 mocks ──
vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => USER_A),
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 1013 },
  WsUserConnectionLimiter: class {
    acquire(): boolean {
      return true
    }
    release(): void {}
  },
}))
vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: () => ({ setFastify: () => {}, registerPlugin: () => {} }),
}))

import { wsBroadcast } from '../src/plugins/ws-broadcast.js'

interface FakeSocket {
  sent: string[]
  send: (msg: string, cb?: (err?: Error) => void) => void
  on: (ev: string, cb: () => void) => void
  close: () => void
  emitClose: () => void
}

/** 把插件挂到一个 fake server 上,拿到装饰出的 broadcastToUser 与注册路由的 handler。 */
async function buildBroadcastHarness() {
  const warnings: Array<{ fields: Record<string, unknown>; msg: string }> = []
  let broadcast: ((userId: string, event: string, data: unknown) => void) | null = null
  let routeHandler: ((socket: FakeSocket, request: unknown) => Promise<void>) | null = null

  const server = {
    // 既有观测出口:只读它已有的字段,不新建第二套 metrics。
    // 两个计数器成对递增(ws-broadcast 的 noteDrop),夹具缺键会在 `+= 1` 处写出 NaN。
    metrics: { wsDisconnectsTotal: 0, wsBroadcastDroppedFramesTotal: 0 },
    log: {
      warn: (fields: Record<string, unknown>, msg: string): void => {
        warnings.push({ fields, msg })
      },
    },
    decorate(name: string, fn: unknown): void {
      if (name === 'broadcastToUser') broadcast = fn as (u: string, e: string, d: unknown) => void
    },
    get(_url: string, _opts: unknown, handler: unknown): void {
      routeHandler = handler as (socket: FakeSocket, request: unknown) => Promise<void>
    },
  }

  await (wsBroadcast as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!broadcast || !routeHandler) throw new Error('ws-broadcast 未装饰 broadcastToUser/未注册路由')

  const makeSocket = (failMode: 'none' | 'throw' | 'callback'): FakeSocket => {
    const handlers: Record<string, Array<() => void>> = {}
    const socket: FakeSocket = {
      sent: [],
      send: (msg: string, cb?: (err?: Error) => void) => {
        if (failMode === 'throw') throw new Error('socket is closed')
        if (failMode === 'callback') {
          cb?.(new Error('WebSocket was closed before the message was sent'))
          return
        }
        socket.sent.push(msg)
        cb?.()
      },
      on: (ev: string, cb: () => void) => {
        ;(handlers[ev] ??= []).push(cb)
      },
      close: () => {},
      emitClose: () => {
        for (const fn of handlers.close ?? []) fn()
      },
    }
    return socket
  }

  const connect = async (failMode: 'none' | 'throw' | 'callback'): Promise<FakeSocket> => {
    const socket = makeSocket(failMode)
    await routeHandler!(socket, { query: { token: 'x' } })
    return socket
  }

  return {
    broadcast: (event = 'tick', data: unknown = { n: 1 }) => broadcast!(USER_A, event, data),
    connect,
    metrics: server.metrics,
    warnings,
  }
}

describe('格② ws-broadcast 发送失败:计数 + 首次喊话 + 不中断广播', () => {
  it('③ send 抛错(同步)⇒ 主流程继续 + 计数 +1 + 首次 warn 恰一次,第二次不重复喊', async () => {
    const h = await buildBroadcastHarness()
    const healthy = await h.connect('none')
    const dead = await h.connect('throw')

    h.broadcast()
    // 主流程继续:同一批次里健康连接确实收到了这一帧
    expect(healthy.sent).toHaveLength(1)
    // 计数落在既有观测出口
    expect(h.metrics.wsDisconnectsTotal).toBe(1)
    // 首次喊话恰一次
    expect(h.warnings).toHaveLength(1)
    expect(h.warnings[0]!.fields.droppedFramesTotal).toBe(1)
    // 喊话内容不含会话数据与事件名(只有计数与 userId)
    expect(JSON.stringify(h.warnings[0]!.fields)).not.toContain('"n":1')
    // 断线连接已被摘掉:再来一帧不会再失败,计数与喊话都不再增长
    dead.emitClose()
    h.broadcast()
    expect(h.metrics.wsDisconnectsTotal).toBe(1)
    expect(h.warnings).toHaveLength(1)
    expect(healthy.sent).toHaveLength(2)
  })

  it('③b ws 的 callback 报错路径同样被看见(旧写法结构上看不见这一型)', async () => {
    const h = await buildBroadcastHarness()
    await h.connect('callback')
    h.broadcast()
    expect(h.metrics.wsDisconnectsTotal).toBe(1)
    expect(h.warnings).toHaveLength(1)
  })

  it('③c 两条连接同时失败 ⇒ 计数各 +1,但只喊一次(节流窗口内静默累计)', async () => {
    const h = await buildBroadcastHarness()
    await h.connect('throw')
    await h.connect('callback')
    h.broadcast()
    expect(h.metrics.wsDisconnectsTotal).toBe(2)
    expect(h.warnings).toHaveLength(1)
    // 首喊只带"喊话那一刻"的累计数(=1);第二条的增量继续静默计入 metrics 与台账,
    // 超窗后的那一次复读才会带出累计数 —— 与既有台账同一语义。
    expect(h.warnings[0]!.fields.droppedFramesTotal).toBe(1)
  })

  it('③d 无连接时早退,不产生任何观测噪音', async () => {
    const h = await buildBroadcastHarness()
    h.broadcast()
    expect(h.metrics.wsDisconnectsTotal).toBe(0)
    expect(h.warnings).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
