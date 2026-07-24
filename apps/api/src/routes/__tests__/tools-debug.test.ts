import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

// 修复(2026-07-24):authenticate 内部调用 jose.decodeJwt(token) 检查 challenge token,
// 'mock-admin-token' 非有效 JWT 会抛异常 → 401。mock decodeJwt 返回非 challenge payload 绕过。
vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('@ihui/database', () => ({
  tools: { id: 'id', name: 'name', status: 'status', category: 'category' },
  toolFavorites: { userId: 'user_id', toolId: 'tool_id' },
}))

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
      values: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import toolsRoutes from '../tools.js'
import { verifyAccessToken } from '@ihui/auth'
import { db } from '../../db/index.js'
import { logger } from '../../utils/logger.js'

const ADMIN_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-admin-id',
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 1,
  })
}

function mockNonAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-user-id',
    phone: '13900000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 0,
  })
}

describe('Tools Debug API (/api/tools/debug/*)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(toolsRoutes, { prefix: '/api/tools' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminAuth()
  })

  describe('requireAdmin 鉴权', () => {
    it('无 auth header 返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        payload: { timeout: 100 },
      })
      expect(res.statusCode).toBe(401)
    })

    it('无效 token 返回 401', async () => {
      vi.mocked(verifyAccessToken).mockRejectedValue(
        Object.assign(new Error('Invalid or expired token'), { statusCode: 401 }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 100 },
      })
      expect(res.statusCode).toBe(401)
    })

    it('非管理员 (roleId=0) 返回 403', async () => {
      mockNonAdminAuth()
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 100 },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.code).toBe(403)
      expect(body.message).toContain('管理员')
    })

    it('/debug/exception 非管理员返回 403', async () => {
      mockNonAdminAuth()
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'client' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('/debug/log 非管理员返回 403', async () => {
      mockNonAdminAuth()
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'hello' },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('POST /api/tools/debug/timeout (dry-run 超时机制)', () => {
    it('timeout=50ms 触发超时: 返回 200 + timedOut=true + message 含 "操作超时"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 50 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.timeoutSet).toBe(50)
      expect(body.data.errorType).toBe('timeout')
      expect(body.data.message).toContain('操作超时')
      expect(body.data.elapsedTime).toBeGreaterThanOrEqual(50)
    })

    it('timeout 默认值 10000 (不传 timeout 字段)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.timeoutSet).toBe(10000)
    })

    it('timeout=0 返回 400 (positive 校验)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 0 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('timeout 超过 60000 返回 400 (max 校验)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 60001 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('timeout 负数返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: -1 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('dry-run 模式: 不写 DB (db.insert 未被调用)', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 50 },
      })
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/tools/debug/exception (dry-run 异常处理)', () => {
    it('errorType=client: 返回 200 + success=false + message 含 "客户端错误"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'client' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.errorType).toBe('client')
      expect(body.data.success).toBe(false)
      expect(body.data.details).toBe('模拟的客户端错误')
      expect(body.data.message).toContain('客户端错误')
    })

    it('errorType=server: 返回 success=false + details 含 "服务器错误"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'server' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.errorType).toBe('server')
      expect(body.data.success).toBe(false)
      expect(body.data.details).toBe('模拟的服务器错误')
    })

    it('errorType=request: 返回 success=false + details 含 "请求错误"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'request' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.details).toBe('模拟的请求错误')
    })

    it('errorType=other: 返回 success=false + details 含 "一般错误"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'other' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.details).toBe('模拟的一般错误')
    })

    it('errorType 缺失返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    it('errorType 非法值返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'invalid' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('dry-run 模式: 不写 DB', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'client' },
      })
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/tools/debug/log (dry-run 日志记录)', () => {
    it('level=info 默认: 返回 200 + success=true + timestamp', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'test info message' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.success).toBe(true)
      expect(body.data.level).toBe('info')
      expect(body.data.message).toBe('test info message')
      expect(body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('level=warn: 调用 logger.warn', async () => {
      const spy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'warn msg', level: 'warn' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.level).toBe('warn')
      expect(spy).toHaveBeenCalledTimes(1)
      const [loggedMsg, meta] = spy.mock.calls[0]!
      expect(loggedMsg).toContain('warn msg')
      expect(meta).toHaveProperty('source', 'debug-endpoint')
    })

    it('level=error: 调用 logger.error', async () => {
      const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'err msg', level: 'error' },
      })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0]![0]).toContain('err msg')
    })

    it('level=debug: 调用 logger.debug', async () => {
      const spy = vi.spyOn(logger, 'debug').mockImplementation(() => undefined)
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'dbg msg', level: 'debug' },
      })
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('message 缺失返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    it('message 空字符串返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: '' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('message 超过 2000 字符返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'x'.repeat(2001) },
      })
      expect(res.statusCode).toBe(400)
    })

    it('level 非法值返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'x', level: 'invalid' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('dry-run 模式: 不写 DB (db.insert 未被调用)', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'no db write' },
      })
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })
  })

  describe('dry-run 模式全局校验', () => {
    it('3 个 debug 端点均不触发 db.insert/write', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 50 },
      })
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'client' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'all dry-run' },
      })
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
      expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
    })

    it('3 个 debug 端点均不触发外部 fetch 调用', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({} as Response)
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/timeout',
        headers: ADMIN_HEADERS,
        payload: { timeout: 50 },
      })
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/exception',
        headers: ADMIN_HEADERS,
        payload: { errorType: 'client' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/tools/debug/log',
        headers: ADMIN_HEADERS,
        payload: { message: 'no fetch' },
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
