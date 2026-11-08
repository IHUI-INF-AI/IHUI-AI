// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-109 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 病灶:ws/customer-service 的 sessionId 来自客户端 query,找到会话后直接挂到该会话的
 * 广播组 —— 任意登录用户拿到他人 sessionId 即可接管客服会话(读消息/冒充客户发言)。
 *
 * 判据:会话属主 ≠ 连接用户时 close(4003) 且不进任何会话;属主一致时照常 cs_connected。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ME = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'

const state = vi.hoisted(() => ({
  sessionOwner: '00000000-0000-4000-8000-0000000000bb',
}))

vi.mock('../src/db/customer-service-queries.js', () => ({
  createSession: vi.fn(async () => ({ sessionId: 'new-session', userId: state.sessionOwner })),
  findSessionBySessionId: vi.fn(async (sessionId: string) => ({
    sessionId,
    userId: state.sessionOwner,
    status: 'waiting',
    agentId: null,
  })),
  assignSession: vi.fn(async () => ({ session: null })),
  closeSession: vi.fn(),
  pickAvailableAgent: vi.fn(async () => null),
  findWaitingSessions: vi.fn(async () => []),
  findAgentByUserId: vi.fn(async () => null),
  updateAgentStatus: vi.fn(),
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => '00000000-0000-4000-8000-0000000000aa'),
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 1009, RATE_LIMITED: 1008 },
  WsUserConnectionLimiter: class {
    acquire() {
      return true
    }
    release() {}
    reset() {}
  },
  WsRateLimiter: class {
    allow() {
      return true
    }
    reset() {}
  },
}))

vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: vi.fn(() => ({
    setFastify: vi.fn(),
    registerPlugin: vi.fn(),
  })),
}))

import { wsCustomerService } from '../src/plugins/ws-customer-service.js'

type Handler = (socket: unknown, request: unknown) => void

function makeFakeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    decorate: vi.fn(),
    get: vi.fn((path: string, _opts: unknown, handler: Handler) => {
      handlers.set(path, handler)
    }),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, handlers }
}

function makeSocket() {
  return { close: vi.fn(), send: vi.fn(), on: vi.fn(), readyState: 1 }
}

function makeRequest(sessionId: string) {
  return {
    query: { token: 'token', sessionId },
    headers: {},
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
}

describe('F-109 客服 WS 会话必须校验属主', () => {
  beforeEach(() => {
    state.sessionOwner = VICTIM
  })

  it('拿他人 sessionId 连接 → close(4003),不进入会话', async () => {
    const { server, handlers } = makeFakeServer()
    await wsCustomerService(server as never, {})
    const handler = handlers.get('/ws/customer-service')
    expect(handler).toBeTruthy()

    const socket = makeSocket()
    handler!(socket, makeRequest('victim-session'))
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalled())
    expect(socket.close).toHaveBeenCalledWith(4003, '无权访问该会话')
    // 未进入会话:不应收到 cs_connected 之类的下行帧
    expect(socket.send).not.toHaveBeenCalled()
  })

  it('属主本人连接照常建立(闸门不误伤)', async () => {
    state.sessionOwner = ME
    const { server, handlers } = makeFakeServer()
    await wsCustomerService(server as never, {})
    const handler = handlers.get('/ws/customer-service')!
    const socket = makeSocket()
    handler(socket, makeRequest('my-session'))
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalled())
    expect(socket.close).not.toHaveBeenCalledWith(4003, expect.anything())
    const connectedFrame = socket.send.mock.calls.some((c) => String(c[0]).includes('cs_connected'))
    expect(connectedFrame).toBe(true)
  })
})
