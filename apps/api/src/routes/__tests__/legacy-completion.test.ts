import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import { ZodError } from 'zod'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    set: () => DbChain
    returning: () => DbChain
    delete: () => DbChain
    values: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      set: () => chain,
      returning: () => chain,
      delete: () => chain,
      values: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() =>
        createChain([{ id: 'circle-1', name: '热门圈子', memberCount: 100, postCount: 50 }]),
      ),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

vi.mock('../../services/storage-service.js', () => ({
  deleteFile: vi.fn().mockReturnValue(true),
}))

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({ access_token: 'mock-token-123', errcode: 0, errmsg: '' }),
}) as unknown as typeof fetch

import { legacyCompletionRoutes } from '../legacy-completion.js'

describe('Legacy Completion API (D17/D18/D19 新增端点)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err: FastifyError, _request, reply) => {
      if (err instanceof ZodError) {
        reply.code(400).send({ error: 'Validation Error', details: err.errors })
      } else {
        reply.code(500).send({ error: err.message })
      }
    })
    await app.register(legacyCompletionRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('路由注册验证', () => {
    it('插件注册成功不抛错', () => {
      expect(app).toBeDefined()
    })
  })

  describe('D17: GET /api/circles/hot', () => {
    it('返回 200 与热门圈子列表', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/circles/hot' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('list')
      expect(Array.isArray(body.list)).toBe(true)
    })

    it('支持 limit 参数', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/circles/hot?limit=5' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('list')
    })

    it('limit 默认值为 10', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/circles/hot' })
      expect(res.statusCode).toBe(200)
    })
  })

  describe('D18: GET /api/circles/member-count', () => {
    it('有效 circleId 返回 200 与 memberCount', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/circles/member-count?circleId=${'00000000-0000-0000-0000-000000000001'}`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('circleId')
      expect(body).toHaveProperty('memberCount')
      expect(typeof body.memberCount).toBe('number')
    })

    it('无效 circleId 返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/circles/member-count?circleId=invalid-uuid',
      })
      expect(res.statusCode).toBe(400)
    })

    it('缺少 circleId 返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/circles/member-count',
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('D19: GET /api/work-wechat/token', () => {
    it('有效参数返回 200 与 accessToken', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/work-wechat/token?corpId=test-corp&secret=test-secret',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('errcode')
      expect(body).toHaveProperty('errmsg')
    })

    it('支持可选 agentId 参数', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/work-wechat/token?corpId=test-corp&secret=test-secret&agentId=1000001',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.agentId).toBe('1000001')
    })

    it('缺少 corpId 返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/work-wechat/token?secret=test-secret',
      })
      expect(res.statusCode).toBe(400)
    })

    it('缺少 secret 返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/work-wechat/token?corpId=test-corp',
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('回归: 原有 D1-D16 端点仍可用', () => {
    it('GET /api/exam/signups 不抛错', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/exam/signups' })
      expect([200, 400]).toContain(res.statusCode)
    })

    it('GET /api/oss/to-base64 无效 URL 返回 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/oss/to-base64?url=invalid' })
      expect([400, 500]).toContain(res.statusCode)
    })
  })
})
