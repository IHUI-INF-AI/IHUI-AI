// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * /ws/relay/chat 端点单测(2026-11-10 立)。
 *
 * 守的是"下游长连接入口"这一层的协议与生命周期:
 * - 连上即 ready;chat 帧 → start → chunk… → done(收尾只发一次)
 * - 非流式 → result 帧
 * - 号池没候选 / 缺字段 / 上游失败 → error 帧,连接不断(客户端可继续发下一轮)
 * - cancel 帧真能中断在途请求
 * - 一条连接多轮复用(这是"长连接"而不是"一次一连接"的判据)
 *
 * 转发语义(选路/号池回落/记账)不在本文件验证 —— 那是 relay-upstream-forwarder 的既有用例。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { AddressInfo } from 'node:net'
import WebSocket from 'ws'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(32)
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
  process.env.NODE_ENV = 'test'
})

const { forwardMock, pipeMock } = vi.hoisted(() => ({
  forwardMock: vi.fn(),
  pipeMock: vi.fn(),
}))

vi.mock('../../services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: forwardMock,
  pipeChannelStream: pipeMock,
}))

vi.mock('../../plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'user-relay-1'),
  wsUpgradeRequiresCredential: () => async () => {},
  WS_CLOSE: {
    MISSING_TOKEN: 4001,
    RATE_LIMITED: 4002,
    INVALID_TOKEN: 4003,
    ACCOUNT_CANCELLED: 4004,
    TOO_MANY_CONNECTIONS: 4005,
  },
  WsUserConnectionLimiter: vi.fn().mockImplementation(function () {
    return { acquire: () => true, release: () => {}, currentCount: () => 0 }
  }),
  WsRateLimiter: vi.fn().mockImplementation(function () {
    return { allow: () => true, reset: () => {} }
  }),
}))

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}))

import fastifyWebsocket from '@fastify/websocket'
import { wsRelayChat } from '../ws-relay-chat.js'

interface Frame {
  type: string
  id?: string
  data?: unknown
  message?: string
  status?: number
}

/**
 * 带帧缓冲的测试客户端。
 *
 * 必须有缓冲:`connect()` 在 `open` 后才 resolve,而服务端的 ready 帧在握手完成那一刻
 * 就已经发出 —— 若等 resolve 之后再挂 'message' 监听,那一帧会因为"当时没有监听器"
 * 被 EventEmitter 直接丢弃,用例就会冤死在"等帧超时"上。
 */
class TestClient {
  private readonly frames: Array<{ text: string; json: Frame | null }> = []
  private readonly waiters: Array<{
    pred: (f: Frame) => boolean
    resolve: (f: Frame) => void
    timer: NodeJS.Timeout
  }> = []

  constructor(readonly ws: WebSocket) {
    ws.on('message', (raw: WebSocket.RawData) => {
      const text = raw.toString()
      let json: Frame | null = null
      try {
        json = JSON.parse(text) as Frame
      } catch {
        json = null
      }
      if (json) {
        const idx = this.waiters.findIndex((w) => w.pred(json!))
        if (idx >= 0) {
          const w = this.waiters.splice(idx, 1)[0]!
          clearTimeout(w.timer)
          w.resolve(json)
          return
        }
      }
      this.frames.push({ text, json })
    })
  }

  /** 等一帧(先扫已缓冲的,再等新到的);超时即失败,避免用例悬挂 */
  waitFor(pred: (f: Frame) => boolean, label: string): Promise<Frame> {
    const idx = this.frames.findIndex((b) => b.json !== null && pred(b.json))
    if (idx >= 0) {
      const hit = this.frames.splice(idx, 1)[0]!
      return Promise.resolve(hit.json!)
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer)
        if (i >= 0) this.waiters.splice(i, 1)
        reject(new Error(`等待帧超时: ${label}`))
      }, 3000)
      this.waiters.push({ pred, resolve, timer })
    })
  }

  /** 等一条纯文本帧(pong) */
  waitText(expected: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const idx = this.frames.findIndex((b) => b.json === null && b.text === expected)
      if (idx >= 0) {
        const hit = this.frames.splice(idx, 1)[0]!
        resolve(hit.text)
        return
      }
      const timer = setTimeout(() => reject(new Error(`等待文本帧超时: ${expected}`)), 3000)
      const onMessage = (raw: WebSocket.RawData): void => {
        if (raw.toString() !== expected) return
        clearTimeout(timer)
        this.ws.off('message', onMessage)
        resolve(expected)
      }
      this.ws.on('message', onMessage)
    })
  }

  send(payload: unknown): void {
    this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
  }

  close(): void {
    this.ws.close()
  }
}

describe('/ws/relay/chat', () => {
  let app: FastifyInstance
  let port: number

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(fastifyWebsocket)
    await app.register(wsRelayChat)
    await app.listen({ port: 0, host: '127.0.0.1' })
    port = (app.server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await app.close()
  })

  // 调用计数用例依赖干净的桩:每个用例自己 mockImplementationOnce,跨用例累积会让
  // "没有被调用"这类断言全部误报(踩过一次)。
  beforeEach(() => {
    forwardMock.mockReset()
    pipeMock.mockReset()
  })

  function connect(): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/relay/chat?token=t`)
      // 先挂监听再等 open:ready 帧在握手完成瞬间就可能到
      const client = new TestClient(ws)
      ws.on('open', () => resolve(client))
      ws.on('error', reject)
    })
  }

  it('连上即 ready,并带 userId', async () => {
    const c = await connect()
    const ready = await c.waitFor((f) => f.type === 'ready', 'ready')
    expect(ready).toMatchObject({ type: 'ready', userId: 'user-relay-1' })
    c.close()
  })

  it('流式一轮:start → chunk×2 → done,且 chunk 内容为剥掉 data: 前缀的 JSON', async () => {
    forwardMock.mockResolvedValueOnce({
      ok: true,
      response: new Response(''),
      channel: {},
      latencyMs: 1,
      latencyTrusted: true,
    })
    pipeMock.mockImplementationOnce(async (_resp: unknown, opts: { writeLine: (l: string) => void }) => {
      opts.writeLine('data: {"choices":[{"delta":{"content":"你"}}]}')
      opts.writeLine('data: {"choices":[{"delta":{"content":"好"}}]}')
      return {}
    })

    const c = await connect()
    await c.waitFor((f) => f.type === 'ready', 'ready')
    c.send({
      type: 'chat',
      id: 'c1',
      model: 'doubao/doubao-seed',
      messages: [{ role: 'user', content: 'hi' }],
    })

    const start = await c.waitFor((f) => f.type === 'start' && f.id === 'c1', 'start')
    expect(start.id).toBe('c1')
    const chunk1 = await c.waitFor((f) => f.type === 'chunk' && f.id === 'c1', 'chunk1')
    expect(chunk1.data).toBe('{"choices":[{"delta":{"content":"你"}}]}')
    await c.waitFor((f) => f.type === 'chunk' && f.id === 'c1', 'chunk2')
    const done = await c.waitFor((f) => f.type === 'done' && f.id === 'c1', 'done')
    expect(done.type).toBe('done')
    c.close()
  })

  it('一条连接可连续跑多轮(长连接复用,不是一次一连接)', async () => {
    forwardMock.mockResolvedValue({
      ok: true,
      response: new Response(''),
      channel: {},
      latencyMs: 1,
      latencyTrusted: true,
    })
    pipeMock.mockImplementation(async (_resp: unknown, opts: { writeLine: (l: string) => void }) => {
      opts.writeLine('data: {"choices":[{"delta":{"content":"x"}}]}')
      return {}
    })

    const c = await connect()
    await c.waitFor((f) => f.type === 'ready', 'ready')
    for (const id of ['r1', 'r2', 'r3']) {
      c.send({
        type: 'chat',
        id,
        model: 'doubao/x',
        messages: [{ role: 'user', content: id }],
      })
      await c.waitFor((f) => f.type === 'done' && f.id === id, `done:${id}`)
    }
    expect(forwardMock).toHaveBeenCalledTimes(3)
    c.close()
  })

  it('非流式请求返回 result 帧', async () => {
    forwardMock.mockResolvedValueOnce({
      ok: true,
      response: Response.json({ choices: [{ message: { content: 'ok' } }] }),
      channel: {},
      latencyMs: 1,
      latencyTrusted: true,
    })
    const c = await connect()
    await c.waitFor((f) => f.type === 'ready', 'ready')
    c.send({
      type: 'chat',
      id: 'n1',
      model: 'doubao/x',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    })
    const result = await c.waitFor((f) => f.type === 'result' && f.id === 'n1', 'result')
    expect(result.data).toMatchObject({ choices: [{ message: { content: 'ok' } }] })
    await c.waitFor((f) => f.type === 'done' && f.id === 'n1', 'done')
    c.close()
  })

  it('号池无候选:回 error 帧但连接保持可用', async () => {
    forwardMock.mockResolvedValueOnce(null)
    const c = await connect()
    await c.waitFor((f) => f.type === 'ready', 'ready')
    c.send({ type: 'chat', id: 'e1', model: 'nope/x', messages: [{ role: 'user', content: 'hi' }] })
    const err = await c.waitFor((f) => f.type === 'error' && f.id === 'e1', 'error')
    expect(err.message).toContain('无可用渠道或账号池候选')
    // 连接未断:还能再发 ping
    c.send('ping')
    expect(await c.waitText('pong')).toBe('pong')
    c.close()
  })

  it('缺 model / 缺 messages 直接回 error,不进入转发', async () => {
    const c = await connect()
    await c.waitFor((f) => f.type === 'ready', 'ready')
    c.send({ type: 'chat', id: 'v1', messages: [{ role: 'user', content: 'hi' }] })
    expect((await c.waitFor((f) => f.type === 'error' && f.id === 'v1', 'no-model')).message).toBe(
      '缺少 model',
    )
    c.send({ type: 'chat', id: 'v2', model: 'm' })
    expect((await c.waitFor((f) => f.type === 'error' && f.id === 'v2', 'no-msg')).message).toBe(
      'messages 必须是非空数组',
    )
    expect(forwardMock).not.toHaveBeenCalled()
    c.close()
  })

  it('上游失败:error 帧带 reason 与 status', async () => {
    forwardMock.mockResolvedValueOnce({ ok: false, reason: '上游 429', lastHttpStatus: 429 })
    const c = await connect()
    await c.waitFor((f) => f.type === 'ready', 'ready')
    c.send({ type: 'chat', id: 'f1', model: 'doubao/x', messages: [{ role: 'user', content: 'hi' }] })
    const err = await c.waitFor((f) => f.type === 'error' && f.id === 'f1', 'error')
    expect(err).toMatchObject({ message: '上游 429', status: 429 })
    c.close()
  })

  it('cancel 帧中断在途请求', async () => {
    let seenSignal: AbortSignal | undefined
    forwardMock.mockImplementationOnce(
      (req: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          seenSignal = req.signal
          // 一直不返回,直到被 abort
          req.signal?.addEventListener('abort', () => resolve({ ok: false, reason: 'aborted' }))
        }),
    )
    const c = await connect()
    await c.waitFor((f) => f.type === 'ready', 'ready')
    c.send({ type: 'chat', id: 'z1', model: 'doubao/x', messages: [{ role: 'user', content: 'hi' }] })
    await c.waitFor((f) => f.type === 'start' && f.id === 'z1', 'start')
    expect(seenSignal?.aborted).toBe(false)
    c.send({ type: 'cancel', id: 'z1' })
    await c.waitFor((f) => f.type === 'error' && f.id === 'z1', 'cancelled')
    expect(seenSignal?.aborted).toBe(true)
    c.close()
  })
})
