// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-467 回归锁(2026-11-13)。
 *
 * 病灶:ws/live-chat 在 close/error 时无条件 `resetUserRateLimit(userId)`,
 * 全局限流窗口被整桶清空 —— 发满 60 条后断开重连即可继续刷屏,且 error+close
 * 双触发会重复清理(重连后窗口永远从零开始),弹幕防洪形同虚设。
 *
 * 本文件锁:
 *   ① 同一用户发满 60 条后第 61 条被拒;
 *   ② close + error 断开并重连后仍受同一 60 条/分钟窗口约束(不重置);
 *   ③ 完整消息路径:第 61 条 history 收到 429 错误帧,重连后依旧 429;
 *   ④ 窗口时间过去(60s 之后)恢复放行 —— 过期靠时间自然发生,不靠断线。
 *
 * 直接调用导出的连接处理函数与限流判定,不触达真实 WS 网络 / PG / Redis。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
import { __resetLiveChatServerForTest, getLiveChatServer } from '../src/websocket/chat-server.js'

/** 与 chat-server 内部常量同口径:60 条/分钟/用户 */
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000

interface MockSocket extends WebSocket {
  _sent: string[]
  _handlers: Record<string, Array<(...args: unknown[]) => void>>
  _emit(event: string, arg?: unknown): void
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
    _emit(event: string, arg?: unknown) {
      for (const fn of handlers[event] ?? []) fn(arg)
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

const HISTORY_FRAME = JSON.stringify({ type: 'history' })
const lastSent = (socket: MockSocket): string => socket._sent[socket._sent.length - 1] ?? ''

describe('F-467 ws/live-chat 断线不得重置全局限流窗口', () => {
  let now: number
  let metrics: LiveChatMetricsSink
  let limiter: WsUserConnectionLimiter
  let handler: ReturnType<typeof createLiveChatConnectionHandler>

  beforeEach(() => {
    __resetLiveChatServerForTest()
    now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    metrics = {
      recordWsRooms: vi.fn(),
      setLiveOnline: vi.fn(),
      deleteLiveOnline: vi.fn(),
      recordWsMessageLatency: vi.fn(),
    }
    limiter = new WsUserConnectionLimiter(MAX_CONNECTIONS_PER_USER)
    handler = createLiveChatConnectionHandler(metrics, limiter)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function connect(
    userId: string,
    roomId = '42',
  ): Promise<{ socket: MockSocket; request: MockRequest }> {
    const socket = makeSocket()
    const request = makeRequest(roomId, userId)
    handler(socket, request)
    await flush()
    return { socket, request }
  }

  it('① 同一用户发满 60 条后第 61 条被限', () => {
    const server = getLiveChatServer()
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      expect(server.allowUserMessage('u-60')).toBe(true)
    }
    expect(server.allowUserMessage('u-60')).toBe(false)
  })

  it('② close + error 断开重连后仍被同一窗口限住(不重置)', async () => {
    const server = getLiveChatServer()
    const first = await connect('u-reconnect')
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      expect(server.allowUserMessage('u-reconnect')).toBe(true)
    }
    expect(server.allowUserMessage('u-reconnect')).toBe(false)

    first.socket._emit('error')
    first.socket._emit('close')
    // 连接资源已清干净:槽位/房间均归零,但窗口必须保留
    expect(limiter.currentCount('u-reconnect')).toBe(0)
    expect(server.totalConnections()).toBe(0)

    const again = await connect('u-reconnect')
    expect(again.socket.close).not.toHaveBeenCalled()
    expect(again.socket._sent.some((s) => s.includes('"joined"'))).toBe(true)
    expect(server.allowUserMessage('u-reconnect')).toBe(false)
  })

  it('③ 完整消息路径:第 61 条 history 收 429,重连后依旧 429', async () => {
    const server = getLiveChatServer()
    vi.spyOn(server, 'fetchHistory').mockResolvedValue([])

    const { socket } = await connect('u-path')
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      socket._emit('message', Buffer.from(HISTORY_FRAME))
      await flush()
    }
    socket._emit('message', Buffer.from(HISTORY_FRAME))
    await flush()
    expect(lastSent(socket)).toContain('"code":429')

    socket._emit('close')
    const again = await connect('u-path')
    again.socket._emit('message', Buffer.from(HISTORY_FRAME))
    await flush()
    expect(lastSent(again.socket)).toContain('"code":429')
  })

  it('④ 窗口时间过去后恢复放行(按时间自然过期)', () => {
    const server = getLiveChatServer()
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      expect(server.allowUserMessage('u-expire')).toBe(true)
    }
    expect(server.allowUserMessage('u-expire')).toBe(false)

    now += RATE_WINDOW_MS + 1
    expect(server.allowUserMessage('u-expire')).toBe(true)
  })
})
