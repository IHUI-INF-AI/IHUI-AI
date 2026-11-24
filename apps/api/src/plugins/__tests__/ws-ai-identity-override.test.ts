// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.COZE_API_KEY ??= 'test-coze-key'
  process.env.NODE_ENV = 'test'
})

const USER_A = 'server-user-a'

const streamBodies = vi.hoisted(() => [] as Record<string, unknown>[])
const aiServiceFetchStream = vi.hoisted(() =>
  vi.fn(async (...args: unknown[]) => {
    const init = args[2] as { body?: string }
    if (init?.body) streamBodies.push(JSON.parse(init.body) as Record<string, unknown>)
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"done","model":"m"}\n\n'))
          controller.close()
        },
      }),
    }
  }),
)
const aiServiceFetch = vi.hoisted(() => vi.fn(async () => ({ ok: true, json: async () => ({}) })))
const fetchMock = vi.hoisted(() =>
  vi.fn(async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'))
        controller.close()
      },
    }),
  })),
)

// 避免加载 @ihui/shared 的真实 barrel(其 auth/token-store 依赖未构建的 @ihui/api-client)。
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch,
  aiServiceFetchStream,
}))

vi.mock('../../routes/ai-vendors.js', () => ({
  cloneTimbre: vi.fn(),
}))

vi.mock('../../plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async (_socket: unknown, token?: string) =>
    token === 'token-a' ? 'server-user-a' : null,
  ),
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

vi.mock('../../plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: vi.fn(() => ({
    setFastify: vi.fn(),
    registerPlugin: vi.fn(),
  })),
}))

import fastifyWebsocket from '@fastify/websocket'
import { wsAi } from '../ws-ai.js'

interface WsLike {
  on: (event: string, handler: (...args: never[]) => void) => void
  send: (data: string) => void
  close: () => void
}

interface Conn {
  ws: WsLike
  frames: string[]
  waitFor: (predicate: (frames: string[]) => boolean) => Promise<string[]>
}

async function connect(app: FastifyInstance, url: string): Promise<Conn> {
  const frames: string[] = []
  const ws = (await app.injectWS(
    url,
    {},
    {
      onInit: (socket: unknown) => {
        const ws = socket as WsLike
        ws.on('message', ((data: Buffer) => frames.push(data.toString())) as never)
      },
    },
  )) as unknown as WsLike
  return {
    ws,
    frames,
    async waitFor(predicate) {
      const deadline = Date.now() + 2_000
      while (!predicate(frames) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20))
      }
      if (!predicate(frames)) throw new Error('等待 WS 帧超时')
      return frames
    },
  }
}

describe('F-112 ws-ai 客户端身份覆盖', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(fastifyWebsocket)
    await app.register(wsAi)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    streamBodies.length = 0
    aiServiceFetchStream.mockClear()
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('客户端 metadata.userId/provider 不能覆盖服务端身份', async () => {
    const conn = await connect(app, '/cozeZhsApi/ws/qwen/stream?token=token-a')
    await conn.waitFor((frames) => frames.some((f) => f.includes('"event":"ready"')))
    conn.ws.send(
      JSON.stringify({
        type: 'capability.start',
        prompt: 'hello',
        model: 'm',
        metadata: { userId: 'victim-user', provider: 'evil-provider', trace: 't1' },
      }),
    )
    await conn.waitFor((frames) => frames.some((f) => f.includes('"event":"capability.done"')))
    conn.ws.close()

    expect(streamBodies).toHaveLength(1)
    const body = streamBodies[0]!
    const metadata = body.metadata as Record<string, unknown>
    expect(metadata.userId).toBe(USER_A)
    expect(metadata.provider).toBe('qwen')
    expect(metadata.userId).not.toBe('victim-user')
    expect(metadata.trace).toBe('t1')
  })

  it('Coze chat.start 的 user_id 固定为服务端身份', async () => {
    const conn = await connect(app, '/ws/coze/chat?token=token-a&bot_id=bot-1')
    await conn.waitFor((frames) => frames.some((f) => f.includes('"event":"ready"')))
    conn.ws.send(JSON.stringify({ type: 'chat.start', user_id: 'victim-user' }))
    const frames = await conn.waitFor((next) =>
      next.some((f) => f.includes('"event":"chat.created"')),
    )
    conn.ws.close()

    const created = frames.find((f) => f.includes('"event":"chat.created"'))!
    expect(JSON.parse(created).data.user_id).toBe(USER_A)
  })

  it('Coze chat.message 不向 Coze 透传客户端 user_id', async () => {
    const conn = await connect(app, '/ws/coze/chat?token=token-a&bot_id=bot-1')
    await conn.waitFor((frames) => frames.some((f) => f.includes('"event":"ready"')))
    conn.ws.send(JSON.stringify({ type: 'chat.message', content: 'hi', user_id: 'victim-user' }))
    const deadline = Date.now() + 2_000
    while (fetchMock.mock.calls.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20))
    }
    conn.ws.close()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as unknown as [unknown, { body?: string }]
    const init = call[1]
    const body = JSON.parse(init.body!) as Record<string, unknown>
    expect(body.user_id).toBe(USER_A)
    expect(body.user_id).not.toBe('victim-user')
  })
})
