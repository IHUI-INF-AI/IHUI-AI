// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-692 路由层:底层失败不能被静音,也不能因并发唯一冲突裸冒泡成框架级 500。
 * 断言返回业务错误体 { code:500, message:'记录浏览失败' }(仍为 5xx,不吞错)。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-0000000000aa'
    return true
  }),
  authenticate: vi.fn(),
}))

const queries = vi.hoisted(() => ({ recordWatch: vi.fn() }))
vi.mock('../src/db/behavior-queries.js', () => ({
  recordWatch: queries.recordWatch,
  getWatchCount: vi.fn(),
  findWatchList: vi.fn(),
  deleteWatch: vi.fn(),
  clearAllWatch: vi.fn(),
  getBehaviorStatistics: vi.fn(),
  findAllWatchList: vi.fn(),
}))

import { behaviorRoutes } from '../src/routes/behavior'

describe('F-692 记录浏览失败返回业务 500', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err: FastifyError, _req, reply) => {
      const code = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(code).send({ code, message: code >= 500 ? '服务器错误' : err.message })
    })
    await server.register(behaviorRoutes, { prefix: '/api' })
    await server.ready()
  })

  it('并发唯一冲突等底层错误 ⇒ 500 且为业务错误体(不是裸冒泡的「服务器错误」)', async () => {
    queries.recordWatch.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "behavior_watch_records_user_topic_unique"'),
    )

    const res = await server.inject({
      method: 'POST',
      url: '/api/behavior/watch',
      body: { topicId: 'lesson-692', topicType: 'lesson', watchDuration: 10 },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ code: 500, message: '记录浏览失败' })
  })
})
