// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-281 回归锁(2026-11-13)。
 *
 * 病灶:GET /api/live/channels/:id 匿名可无限刷浏览量(每次 GET 无条件 +1);
 * POST /api/live/notify/stream-end 无鉴权即可触发指标自增。
 *
 * 本文件锁:
 *   ① 浏览量按 IP+频道 60s 窗口去重(Redis SET EX 60 NX),同 IP 同频道窗口内只计一次;
 *   ② 不同 IP 各自计数;窗口过期后可再计;
 *   ③ /live/notify/* 无密钥头 401、错密钥 403、正确密钥放行;
 *   ④ 服务端密钥未配置时 fail-closed 503(不裸奔)。
 *
 * redis 用内存假实现注入(server.decorate('redis', ...)),不触达真实 PG/Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6399'
})

const NOTIFY_SECRET = 'f281-notify-shared-secret'

const { configMock } = vi.hoisted(() => ({
  configMock: { TENCENT_LIVE_CALLBACK_KEY: 'f281-notify-shared-secret' },
}))
vi.mock('../src/config/index.js', () => ({ config: configMock }))

vi.mock('../src/plugins/auth.js', () => ({ checkAuth: vi.fn(async () => true) }))
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

const { mockFindChannel, mockIncrementView, mockRecordDisconnected } = vi.hoisted(() => ({
  mockFindChannel: vi.fn(),
  mockIncrementView: vi.fn(async () => undefined),
  mockRecordDisconnected: vi.fn(),
}))

vi.mock('../src/db/live-queries.js', () => {
  const explicit: Record<string, unknown> = {
    findLiveChannelById: mockFindChannel,
    incrementLiveViewCount: mockIncrementView,
  }
  return new Proxy(explicit, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      if (prop === 'then') return undefined
      if (prop in target) return target[prop]
      return vi.fn()
    },
  })
})

import { liveRoutes, LIVE_VIEW_DEDUP_WINDOW_SECONDS, liveViewDedupKey } from '../src/routes/live.js'

const CHANNEL_ID = '11111111-1111-4111-8111-111111111111'
const CHANNEL = {
  id: CHANNEL_ID,
  title: 'F-281 频道',
  isPublished: true,
  isLive: true,
  status: 1,
  viewCount: 0,
  lecturerName: null,
  playUrl: null,
}

/** 最小 Redis 假实现:只支持 `SET key value EX ttl NX`,自带可推进的时钟用于窗口过期。 */
class FakeRedis {
  private readonly expiresAt = new Map<string, number>()
  private clockMs = Date.now()

  async set(key: string, value: string, mode: 'EX', ttlSeconds: number, nx?: 'NX'): Promise<unknown> {
    if (mode !== 'EX' || !Number.isFinite(ttlSeconds)) throw new Error('unexpected SET args')
    if (value !== '1') throw new Error('unexpected SET value')
    const current = this.expiresAt.get(key)
    if (nx === 'NX' && current !== undefined && current > this.clockMs) return null
    this.expiresAt.set(key, this.clockMs + ttlSeconds * 1000)
    return 'OK'
  }

  advance(ms: number): void {
    this.clockMs += ms
  }

  reset(): void {
    this.expiresAt.clear()
    this.clockMs = Date.now()
  }
}

describe('F-281 直播浏览量去重 + notify 鉴权', () => {
  let app: FastifyInstance
  let redis: FakeRedis

  beforeAll(async () => {
    app = Fastify({ logger: false })
    redis = new FakeRedis()
    const decorable = app as unknown as { decorate(name: string, value: unknown): void }
    decorable.decorate('redis', redis)
    // stream-end 会调 server.recordLiveStreamDisconnected()(由 business-metrics 插件装配)
    decorable.decorate('recordLiveStreamDisconnected', mockRecordDisconnected)
    await app.register(liveRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    configMock.TENCENT_LIVE_CALLBACK_KEY = NOTIFY_SECRET
    mockFindChannel.mockReset()
    mockFindChannel.mockResolvedValue(CHANNEL)
    mockIncrementView.mockClear()
    mockRecordDisconnected.mockClear()
    redis.reset()
  })

  const getChannel = (remoteAddress: string) =>
    app.inject({ method: 'GET', url: `/api/live/channels/${CHANNEL_ID}`, remoteAddress })

  const notifyEnd = (headers: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/live/notify/stream-end',
      headers: { 'content-type': 'application/json', ...headers },
      payload: { streamId: 'stream-1', eventType: 'stream_end' },
    })

  describe('浏览量 IP+频道 60s 去重', () => {
    it('窗口常量为 60s,去重键同时包含频道与 IP', () => {
      expect(LIVE_VIEW_DEDUP_WINDOW_SECONDS).toBe(60)
      expect(liveViewDedupKey('ch-a', '1.1.1.1')).toContain('ch-a')
      expect(liveViewDedupKey('ch-a', '1.1.1.1')).toContain('1.1.1.1')
      expect(liveViewDedupKey('ch-a', '1.1.1.1')).not.toBe(liveViewDedupKey('ch-b', '1.1.1.1'))
    })

    it('同 IP 同频道 60s 内第二次不计浏览量', async () => {
      const first = await getChannel('203.0.113.10')
      const second = await getChannel('203.0.113.10')
      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(200)
      expect(mockIncrementView).toHaveBeenCalledTimes(1)
      expect(mockIncrementView).toHaveBeenCalledWith(CHANNEL_ID)
    })

    it('不同 IP 访问同一频道分别计数', async () => {
      await getChannel('203.0.113.11')
      await getChannel('203.0.113.12')
      expect(mockIncrementView).toHaveBeenCalledTimes(2)
    })

    it('窗口过期(60s 后)同一 IP 可再计', async () => {
      await getChannel('203.0.113.13')
      expect(mockIncrementView).toHaveBeenCalledTimes(1)
      redis.advance(60_001)
      await getChannel('203.0.113.13')
      expect(mockIncrementView).toHaveBeenCalledTimes(2)
    })

    it('别名路由 GET /live/:id 共用同一份去重', async () => {
      const hit = (remoteAddress: string) =>
        app.inject({ method: 'GET', url: `/api/live/${CHANNEL_ID}`, remoteAddress })
      await hit('203.0.113.14')
      await hit('203.0.113.14')
      expect(mockIncrementView).toHaveBeenCalledTimes(1)
    })
  })

  describe('/live/notify/* 共享密钥鉴权', () => {
    it('无密钥头被拒(401)', async () => {
      const res = await notifyEnd()
      expect(res.statusCode).toBe(401)
      expect(mockRecordDisconnected).not.toHaveBeenCalled()
    })

    it('密钥错误被拒(403)', async () => {
      const res = await notifyEnd({ 'x-live-notify-secret': 'wrong-secret' })
      expect(res.statusCode).toBe(403)
      expect(mockRecordDisconnected).not.toHaveBeenCalled()
    })

    it('密钥正确放行(200)且断开事件计数', async () => {
      const res = await notifyEnd({ 'x-live-notify-secret': NOTIFY_SECRET })
      expect(res.statusCode).toBe(200)
      expect(mockRecordDisconnected).toHaveBeenCalledTimes(1)
    })

    it('服务端密钥未配置时 fail-closed 503', async () => {
      configMock.TENCENT_LIVE_CALLBACK_KEY = ''
      const res = await notifyEnd({ 'x-live-notify-secret': NOTIFY_SECRET })
      expect(res.statusCode).toBe(503)
      expect(mockRecordDisconnected).not.toHaveBeenCalled()
    })
  })
})
