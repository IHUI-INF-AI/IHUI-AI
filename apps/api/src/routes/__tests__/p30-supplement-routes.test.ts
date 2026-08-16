import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

vi.mock('../../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
  },
}))

vi.mock('../../db/point-queries.js', () => ({
  findUserPointsBalance: vi.fn().mockResolvedValue(100),
  awardAdPoints: vi.fn().mockResolvedValue({ beforeBalance: 100, afterBalance: 120 }),
}))

vi.mock('@ihui/database', () => ({
  eduPointRecords: {},
}))

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({ task_id: 'test-task-id', status: 'succeeded' }),
}) as unknown as typeof fetch

import { webrtcVoiceRoutes } from '../webrtc-voice.js'
import { outboundRoutes } from '../outbound.js'
import { aiVideoComposeRoutes } from '../ai-video-compose.js'
import { legacyLangchainRoutes } from '../legacy-langchain.js'
import { rewardedVideoAdRoutes } from '../rewarded-video-ad.js'
import { luyalaRoutes } from '../ai-vendors/luyala.js'

describe('P30 补写路由集成测试', () => {
  describe('路由注册(无插件冲突)', () => {
    it('webrtc-voice 路由可注册', async () => {
      const app = Fastify({ logger: false })
      await app.register(webrtcVoiceRoutes, { prefix: '/api/webrtc-voice' })
      await app.ready()
      expect(app).toBeDefined()
      await app.close()
    })

    it('outbound 路由可注册', async () => {
      const app = Fastify({ logger: false })
      await app.register(outboundRoutes, { prefix: '/api/outbound' })
      await app.ready()
      expect(app).toBeDefined()
      await app.close()
    })

    it('ai-video-compose 路由可注册', async () => {
      const app = Fastify({ logger: false })
      await app.register(aiVideoComposeRoutes, { prefix: '/api/ai-video-compose' })
      await app.ready()
      expect(app).toBeDefined()
      await app.close()
    })

    it('legacy-langchain 路由可注册', async () => {
      const app = Fastify({ logger: false })
      await app.register(legacyLangchainRoutes, { prefix: '/api/langchain' })
      await app.ready()
      expect(app).toBeDefined()
      await app.close()
    })

    it('rewarded-video-ad 路由可注册', async () => {
      const app = Fastify({ logger: false })
      await app.register(rewardedVideoAdRoutes, { prefix: '/api/rewarded-video-ad' })
      await app.ready()
      expect(app).toBeDefined()
      await app.close()
    })

    it('luyala 路由可注册', async () => {
      const app = Fastify({ logger: false })
      await app.register(luyalaRoutes, { prefix: '/api/ai-vendors/luyala' })
      await app.ready()
      expect(app).toBeDefined()
      await app.close()
    })
  })

  describe('鉴权:未登录请求返回 401', () => {
    const authEndpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: unknown
      prefix: string
      plugin: (app: FastifyInstance) => Promise<void>
    }> = [
      {
        method: 'POST',
        url: '/api/webrtc-voice/session',
        payload: { calleeId: 'user-2' },
        prefix: 'webrtc-voice',
        plugin: async (app) => app.register(webrtcVoiceRoutes, { prefix: '/api/webrtc-voice' }),
      },
      {
        method: 'POST',
        url: '/api/webrtc-voice/offer',
        payload: { sessionId: 's1', offer: {} },
        prefix: 'webrtc-voice',
        plugin: async (app) => app.register(webrtcVoiceRoutes, { prefix: '/api/webrtc-voice' }),
      },
      {
        method: 'POST',
        url: '/api/webrtc-voice/ice-candidate',
        payload: { sessionId: 's1', candidate: {} },
        prefix: 'webrtc-voice',
        plugin: async (app) => app.register(webrtcVoiceRoutes, { prefix: '/api/webrtc-voice' }),
      },
      {
        method: 'POST',
        url: '/api/webrtc-voice/end',
        payload: { sessionId: 's1' },
        prefix: 'webrtc-voice',
        plugin: async (app) => app.register(webrtcVoiceRoutes, { prefix: '/api/webrtc-voice' }),
      },
      {
        method: 'POST',
        url: '/api/outbound/campaign',
        payload: { name: 'c', script: 's', phoneList: ['1'] },
        prefix: 'outbound',
        plugin: async (app) => app.register(outboundRoutes, { prefix: '/api/outbound' }),
      },
      {
        method: 'GET',
        url: '/api/outbound/campaign',
        prefix: 'outbound',
        plugin: async (app) => app.register(outboundRoutes, { prefix: '/api/outbound' }),
      },
      {
        method: 'POST',
        url: '/api/ai-video-compose/',
        payload: { prompt: 'p' },
        prefix: 'ai-video-compose',
        plugin: async (app) =>
          app.register(aiVideoComposeRoutes, { prefix: '/api/ai-video-compose' }),
      },
      {
        method: 'GET',
        url: '/api/ai-video-compose/task-1',
        prefix: 'ai-video-compose',
        plugin: async (app) =>
          app.register(aiVideoComposeRoutes, { prefix: '/api/ai-video-compose' }),
      },
      {
        method: 'POST',
        url: '/api/langchain/chat',
        payload: { messages: [{ role: 'user', content: 'hi' }] },
        prefix: 'langchain',
        plugin: async (app) => app.register(legacyLangchainRoutes, { prefix: '/api/langchain' }),
      },
      {
        method: 'POST',
        url: '/api/langchain/agent',
        payload: { input: 'hi' },
        prefix: 'langchain',
        plugin: async (app) => app.register(legacyLangchainRoutes, { prefix: '/api/langchain' }),
      },
      {
        method: 'GET',
        url: '/api/langchain/models',
        prefix: 'langchain',
        plugin: async (app) => app.register(legacyLangchainRoutes, { prefix: '/api/langchain' }),
      },
      {
        method: 'POST',
        url: '/api/ai-vendors/luyala/video',
        payload: { prompt: 'p' },
        prefix: 'ai-vendors/luyala',
        plugin: async (app) => app.register(luyalaRoutes, { prefix: '/api/ai-vendors/luyala' }),
      },
      {
        method: 'POST',
        url: '/api/ai-vendors/luyala/voice',
        payload: { text: 't' },
        prefix: 'ai-vendors/luyala',
        plugin: async (app) => app.register(luyalaRoutes, { prefix: '/api/ai-vendors/luyala' }),
      },
      {
        method: 'GET',
        url: '/api/ai-vendors/luyala/tasks/task-1',
        prefix: 'ai-vendors/luyala',
        plugin: async (app) => app.register(luyalaRoutes, { prefix: '/api/ai-vendors/luyala' }),
      },
    ]

    for (const { method, url, payload, plugin } of authEndpoints) {
      it(`${method} ${url} 未登录返回 401`, async () => {
        const app = Fastify({ logger: false })
        await plugin(app)
        await app.ready()
        const res = await app.inject({
          method,
          url,
          payload: payload as Record<string, unknown> | undefined,
        })
        expect(res.statusCode).toBe(401)
        await app.close()
      })
    }
  })

  describe('rewarded-video-ad 不需要用户鉴权但需要数据库', () => {
    let app: FastifyInstance

    const TEST_SECRET = 'test-secret-for-rewarded-ad'
    const sig = (userId: string, transactionId: string, secret: string): string =>
      createHash('sha256').update(`${userId}${transactionId}${secret}`).digest('hex')

    beforeAll(async () => {
      process.env.REWARDED_AD_SECRET = TEST_SECRET
      app = Fastify({ logger: false })
      // mock redis:SET key value EX ttl NX 行为(首次返回 'OK',重复 key 返回 null)
      // + incrby/decrby/expire/del(P0-5 每日积分上限需要)
      const seenTxKeys = new Set<string>()
      const dailyCounts = new Map<string, number>()
      app.decorate('redis', {
        // mock ioredis set: NX 语义(首次 'OK',重复 null);类型断言避开 ioredis 完整 Redis 类型签名
        set: vi.fn(async (key: string): Promise<'OK' | null> => {
          if (seenTxKeys.has(key)) return null
          seenTxKeys.add(key)
          return 'OK'
        }),
        incrby: vi.fn(async (key: string, increment: number): Promise<number> => {
          const current = dailyCounts.get(key) ?? 0
          const next = current + increment
          dailyCounts.set(key, next)
          return next
        }),
        decrby: vi.fn(async (key: string, decrement: number): Promise<number> => {
          const current = dailyCounts.get(key) ?? 0
          const next = Math.max(0, current - decrement)
          dailyCounts.set(key, next)
          return next
        }),
        expire: vi.fn(async (): Promise<number> => 1),
        del: vi.fn(async (key: string): Promise<number> => {
          seenTxKeys.delete(key)
          dailyCounts.delete(key)
          return 1
        }),
      } as never)
      app.decorate('pushNotification', vi.fn<(userId: string, payload: unknown) => void>())
      await app.register(rewardedVideoAdRoutes, { prefix: '/api/rewarded-video-ad' })
      await app.ready()
    })

    afterAll(async () => {
      await app.close()
    })

    it('GET /config 返回广告配置', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/rewarded-video-ad/config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveProperty('adUnitId')
      expect(body.data).toHaveProperty('rewardPoints')
      expect(body.data).toHaveProperty('dailyLimit')
      expect(body.data).toHaveProperty('enabled')
    })

    it('POST /notify 成功发放积分', async () => {
      const userId = '00000000-0000-0000-0000-000000000001'
      const transactionId = 'tx-001'
      const res = await app.inject({
        method: 'POST',
        url: '/api/rewarded-video-ad/notify',
        payload: {
          userId,
          adType: 'rewarded',
          rewardAmount: 20,
          transactionId,
          signature: sig(userId, transactionId, TEST_SECRET),
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.awarded).toBe(true)
      expect(body.data.amount).toBe(20)
      expect(body.data.balance).toBe(120)
    })

    it('POST /notify 重复 transactionId 返回 duplicated', async () => {
      const userId = '00000000-0000-0000-0000-000000000002'
      const transactionId = 'tx-001'
      const res = await app.inject({
        method: 'POST',
        url: '/api/rewarded-video-ad/notify',
        payload: {
          userId,
          rewardAmount: 10,
          transactionId,
          signature: sig(userId, transactionId, TEST_SECRET),
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.duplicated).toBe(true)
      expect(body.data.awarded).toBe(false)
    })
  })
})
