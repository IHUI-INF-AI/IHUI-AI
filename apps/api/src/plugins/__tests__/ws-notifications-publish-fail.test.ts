// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]: F-113 回归夹具。

/**
 * F-113 回归(2026-11-08):多实例模式下 Redis publish 失败时不得静默丢通知。
 *
 * 改前必红口径(按「哪一次投递」断言):
 *  - 用户 u1 已在本实例建立 WS 连接;
 *  - pushNotification('u1', payload) 走 `void publisher.publish(...)` 分支,
 *    publish 返回 rejected Promise,外层同步 try/catch 抓不到;
 *  - 旧代码:客户端一帧都收不到,waitFor 超时,实际投递 0 次;
 *  - 新代码:publish 失败后回落本机直连,客户端收到 {type:'notification', data:payload}。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(32)
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
  process.env.NODE_ENV = 'test'
})

const { publishMock } = vi.hoisted(() => ({
  publishMock: vi.fn(),
}))

vi.mock('ioredis', () => {
  // 注意：必须是可构造的 function（箭头函数不能被 new，插件会退化进单实例分支）
  const RedisStub = vi.fn(function () {
    return {
      on: vi.fn(),
      psubscribe: vi.fn().mockResolvedValue(undefined),
      publish: publishMock,
    }
  })
  return { default: RedisStub }
})

vi.mock('../auth.js', () => ({
  authenticate: vi.fn(),
}))

vi.mock('../ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'u1'),
  wsUpgradeRequiresCredential: () => async () => undefined,
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
}))

vi.mock('../ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: vi.fn(() => ({
    setFastify: vi.fn(),
    registerPlugin: vi.fn(),
  })),
}))

import fastifyWebsocket from '@fastify/websocket'
import { wsNotifications } from '../ws-notifications.js'

interface WsLike {
  on: (event: string, handler: (...args: never[]) => void) => void
  send: (data: string) => void
  close: () => void
}

async function waitForFrames(frames: string[], ms = 1_500): Promise<string[]> {
  const deadline = Date.now() + ms
  while (frames.length === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 20))
  }
  return frames
}

describe('F-113 Redis publish 失败不得静默丢通知', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(fastifyWebsocket)
    // 多实例模式：subscriber 存在 + server.redis 存在；publish 必然失败
    app.decorate('redis', { publish: publishMock } as never)
    await app.register(wsNotifications)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('publish 拒绝时本机连接仍应收到该条通知', async () => {
    const frames: string[] = []
    const ws = (await app.injectWS(
      '/ws/notifications?token=t',
      {},
      {
        onInit: (socket: unknown) => {
          const s = socket as WsLike
          s.on('message', ((data: Buffer) => frames.push(data.toString())) as never)
        },
      },
    )) as unknown as WsLike
    // 等 wsAuth 的异步注册落表（mock 返回 u1）
    await new Promise((r) => setTimeout(r, 80))

    publishMock.mockImplementation(() => Promise.reject(new Error('redis down')))
    app.pushNotification('u1', { id: 'n-1', title: '新私信' })

    const received = await waitForFrames(frames)
    expect(received).toEqual([JSON.stringify({ type: 'notification', data: { id: 'n-1', title: '新私信' } })])
    ws.close()
  })
})
