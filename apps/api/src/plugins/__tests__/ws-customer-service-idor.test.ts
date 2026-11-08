// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const USER_A = 'user-a'

const mocks = vi.hoisted(() => ({
  wsAuth: vi.fn(async (_socket: unknown, token?: string) => {
    if (token === 'token-a') return 'user-a'
    if (token === 'token-b') return 'user-b'
    return null
  }),
  findSessionBySessionId: vi.fn(),
  createSession: vi.fn(),
  assignSession: vi.fn(),
  closeSession: vi.fn(),
  pickAvailableAgent: vi.fn(async () => null),
  findWaitingSessions: vi.fn(async () => []),
  findAgentByUserId: vi.fn(),
  updateAgentStatus: vi.fn(),
}))

vi.mock('../../plugins/ws-helpers.js', () => ({
  wsAuth: mocks.wsAuth,
  WS_CLOSE: {
    MISSING_TOKEN: 4001,
    RATE_LIMITED: 4002,
    INVALID_TOKEN: 4003,
    ACCOUNT_CANCELLED: 4004,
    TOO_MANY_CONNECTIONS: 4005,
  },
  WsUserConnectionLimiter: vi.fn().mockImplementation(function () {
    return { acquire: vi.fn(() => true), release: vi.fn(), currentCount: vi.fn(() => 0) }
  }),
  WsRateLimiter: vi.fn().mockImplementation(function () {
    return { allow: vi.fn(() => true), reset: vi.fn() }
  }),
}))

vi.mock('../../db/customer-service-queries.js', () => ({
  createSession: mocks.createSession,
  findSessionBySessionId: mocks.findSessionBySessionId,
  assignSession: mocks.assignSession,
  closeSession: mocks.closeSession,
  pickAvailableAgent: mocks.pickAvailableAgent,
  findWaitingSessions: mocks.findWaitingSessions,
  findAgentByUserId: mocks.findAgentByUserId,
  updateAgentStatus: mocks.updateAgentStatus,
}))

vi.mock('../../plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: vi.fn(() => ({
    setFastify: vi.fn(),
    registerPlugin: vi.fn(),
  })),
}))

import fastifyWebsocket from '@fastify/websocket'
import { wsCustomerService } from '../ws-customer-service.js'

interface InjectWS {
  on: (event: string, handler: (...args: never[]) => void) => void
  send: (data: string) => void
  close: () => void
}

function closeCodeOf(app: FastifyInstance, url: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('连接未被拒绝(close 未触发)')), 2_000)
    void app
      .injectWS(
        url,
        {},
        {
          onInit: (socket: unknown) => {
            const ws = socket as InjectWS
            ws.on('close', ((code: number) => {
              clearTimeout(timer)
              resolve(code)
            }) as never)
          },
        },
      )
      .catch((e: Error) => {
        clearTimeout(timer)
        reject(e)
      })
  })
}

async function joinAndReadFirstFrame(app: FastifyInstance, url: string): Promise<string> {
  const frames: string[] = []
  const ws = (await app.injectWS(
    url,
    {},
    {
      onInit: (socket: unknown) => {
        const ws = socket as InjectWS
        ws.on('message', ((data: Buffer) => frames.push(data.toString())) as never)
      },
    },
  )) as unknown as InjectWS
  const deadline = Date.now() + 2_000
  while (frames.length === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 20))
  }
  ws.close()
  if (frames[0] === undefined) throw new Error('未收到 cs_connected')
  return frames[0]
}

describe('F-109 客服 WS 会话归属(IDOR)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(fastifyWebsocket)
    await app.register(wsCustomerService)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mocks.findSessionBySessionId.mockReset()
    mocks.createSession.mockReset()
  })

  it('连接他人 sessionId 被 close(4004) 拒绝', async () => {
    mocks.findSessionBySessionId.mockResolvedValue({
      sessionId: 'session-a',
      userId: USER_A,
      status: 'active',
      queuePosition: 0,
      agentId: 'agent-1',
    })
    const code = await closeCodeOf(app, '/ws/customer-service?token=token-b&sessionId=session-a')
    expect(code).toBe(4004)
  })

  it('已关闭会话即便本人也不可接入', async () => {
    mocks.findSessionBySessionId.mockResolvedValue({
      sessionId: 'session-a',
      userId: USER_A,
      status: 'closed',
      queuePosition: 0,
      agentId: null,
    })
    const code = await closeCodeOf(app, '/ws/customer-service?token=token-a&sessionId=session-a')
    expect(code).toBe(4004)
  })

  it('本人连接自有 sessionId 正常收到 cs_connected', async () => {
    mocks.findSessionBySessionId.mockResolvedValue({
      sessionId: 'session-a',
      userId: USER_A,
      status: 'active',
      queuePosition: 0,
      agentId: 'agent-1',
    })
    const frame = await joinAndReadFirstFrame(
      app,
      '/ws/customer-service?token=token-a&sessionId=session-a',
    )
    const body = JSON.parse(frame) as { type: string; data: { sessionId: string; role: string } }
    expect(body.type).toBe('cs_connected')
    expect(body.data.sessionId).toBe('session-a')
    expect(body.data.role).toBe('customer')
  })
})
