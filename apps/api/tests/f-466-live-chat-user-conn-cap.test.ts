// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-466 回归锁(2026-11-13)。
 *
 * 病灶:ws/live-chat 独缺单用户连接上限,MAX_ROOMS 只回收空房 ——
 * 同一 JWT 可无限建立连接/房间,占满 socket 与 rooms Map。
 *
 * 本文件锁:
 *   ① 同一用户第 N+1 条连接被拒(4005 + warn),不进入房间;
 *   ② 断开后槽位释放,可重新连接(error/close 双触发只减一次);
 *   ③ 不同用户互不影响;
 *   ④ 正常单连接流程(joined 帧、房间计数、指标)不变;
 *   ⑤ chat-server 房间数硬上限:无可回收空房时 canJoinRoom=false。
 *
 * 直接调用导出的连接处理函数,不触达真实 WS 握手 / PG / Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WebSocket } from '@fastify/websocket'
import type { FastifyRequest } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
})

// wsAuth 真实路径:token 直接当作 userId 返回
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(async () => {
    throw new Error('no access token')
  }),
  verifyWsToken: vi.fn(async (token: string) => (token ? { userId: token } : null)),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn(async () => 1),
}))

vi.mock('../src/db/index.js', () => ({ db: {} }))

vi.mock('../src/plugins/business-metrics.js', () => ({
  recordLiveDanmaku: vi.fn(),
}))

import {
  createLiveChatConnectionHandler,
  MAX_CONNECTIONS_PER_USER,
  type LiveChatMetricsSink,
} from '../src/routes/ws/live-chat.js'
import { WsUserConnectionLimiter } from '../src/plugins/ws-helpers.js'
import {
  LiveChatServer,
  MAX_ROOMS,
  __resetLiveChatServerForTest,
  getLiveChatServer,
} from '../src/websocket/chat-server.js'

interface MockSocket extends WebSocket {
  _sent: string[]
  _handlers: Record<string, Array<(...args: unknown[]) => void>>
  _emit(event: string): void
}

function makeSocket(): MockSocket {
  const sent: string[] = []
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
  return {
    send: vi.fn((data: string) => {
      sent.push(data)
    }),
    close: vi.fn(),
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers[event] = handlers[event] ?? []
      handlers[event].push(fn)
    }),
    _sent: sent,
    _handlers: handlers,
    _emit(event: string) {
      for (const fn of handlers[event] ?? []) fn()
    },
  } as unknown as MockSocket
}

type MockRequest = FastifyRequest & { log: { warn: ReturnType<typeof vi.fn> } }

function makeRequest(roomId: string, token: string): MockRequest {
  return {
    query: { roomId, token },
    log: { warn: vi.fn() },
  } as unknown as MockRequest
}

/** 等待处理器内部 async 段跑完(仅微任务 + 一次宏任务) */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('F-466 ws/live-chat 单用户连接上限', () => {
  let metrics: LiveChatMetricsSink
  let limiter: WsUserConnectionLimiter
  let handler: ReturnType<typeof createLiveChatConnectionHandler>

  beforeEach(() => {
    __resetLiveChatServerForTest()
    metrics = {
      recordWsRooms: vi.fn(),
      setLiveOnline: vi.fn(),
      deleteLiveOnline: vi.fn(),
      recordWsMessageLatency: vi.fn(),
    }
    limiter = new WsUserConnectionLimiter(MAX_CONNECTIONS_PER_USER)
    handler = createLiveChatConnectionHandler(metrics, limiter)
  })

  async function connect(
    userId: string,
    roomId = '42',
  ): Promise<{
    socket: MockSocket
    request: MockRequest
  }> {
    const socket = makeSocket()
    const request = makeRequest(roomId, userId)
    handler(socket, request)
    await flush()
    return { socket, request }
  }

  it('① 同一用户第 N+1 条连接被拒(4005),不进入房间', async () => {
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
      const { socket } = await connect('u-cap')
      expect(socket.close).not.toHaveBeenCalled()
    }
    expect(limiter.currentCount('u-cap')).toBe(MAX_CONNECTIONS_PER_USER)
    expect(getLiveChatServer().totalConnections()).toBe(MAX_CONNECTIONS_PER_USER)

    const { socket, request } = await connect('u-cap')
    expect(socket.close).toHaveBeenCalledWith(4005, '单用户连接数超限')
    expect(request.log.warn).toHaveBeenCalled()
    // 被拒连接未占房间槽位
    expect(getLiveChatServer().totalConnections()).toBe(MAX_CONNECTIONS_PER_USER)
  })

  it('② 断开后槽位释放,可重新连接;error+close 只减一次', async () => {
    const first = await connect('u-re')
    for (let i = 1; i < MAX_CONNECTIONS_PER_USER; i += 1) {
      await connect('u-re')
    }
    expect(limiter.currentCount('u-re')).toBe(MAX_CONNECTIONS_PER_USER)

    // error 与 close 双触发:计数只应减一次
    first.socket._emit('error')
    first.socket._emit('close')
    expect(limiter.currentCount('u-re')).toBe(MAX_CONNECTIONS_PER_USER - 1)

    const again = await connect('u-re')
    expect(again.socket.close).not.toHaveBeenCalled()
    expect(again.socket._sent.some((s) => s.includes('"joined"'))).toBe(true)
    expect(limiter.currentCount('u-re')).toBe(MAX_CONNECTIONS_PER_USER)
  })

  it('③ 不同用户互不影响', async () => {
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
      await connect('u-a')
    }
    expect(limiter.currentCount('u-a')).toBe(MAX_CONNECTIONS_PER_USER)

    const { socket } = await connect('u-b')
    expect(socket.close).not.toHaveBeenCalled()
    expect(limiter.currentCount('u-b')).toBe(1)
    expect(limiter.currentCount('u-a')).toBe(MAX_CONNECTIONS_PER_USER)
  })

  it('④ 正常单连接流程不变(joined 帧 / 房间 / 指标 / 退房)', async () => {
    const { socket } = await connect('u-normal', '7')
    expect(socket.close).not.toHaveBeenCalled()
    expect(socket._sent.some((s) => s.includes('"type":"system"') && s.includes('"joined"'))).toBe(
      true,
    )
    expect(metrics.recordWsRooms).toHaveBeenCalledWith(1)
    expect(metrics.setLiveOnline).toHaveBeenCalledWith('7', 1)
    expect(getLiveChatServer().getRoomSize('7')).toBe(1)

    socket._emit('close')
    expect(metrics.deleteLiveOnline).toHaveBeenCalledWith('7')
    expect(getLiveChatServer().roomCount()).toBe(0)
    expect(limiter.currentCount('u-normal')).toBe(0)
  })

  it('⑤ chat-server 房间数硬上限:无可回收空房时拒绝新建', () => {
    const server = new LiveChatServer()
    for (let i = 0; i < MAX_ROOMS; i += 1) {
      server.join(String(i), makeSocket())
    }
    expect(server.roomCount()).toBe(MAX_ROOMS)
    expect(server.canJoinRoom('new-room')).toBe(false)
    // 已存在的房间仍允许加入
    expect(server.canJoinRoom('0')).toBe(true)
  })
})
