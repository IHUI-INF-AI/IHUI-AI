// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 反代号池 · 模型目录/别名(2026-10-22 立):relay-model-catalog 服务 + 管理面目录三件套。
// DB 走仓内 Proxy chainable mock 模式(夹具写法参考 tests/admin-missing-routes.test.ts)。

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const {
  mockVerifyAccessToken,
  mockSelectResult,
  mockInsertResult,
  mockUpdateResult,
  mockDeleteResult,
  sinks,
  rearmDbMockDefaults,
} = vi.hoisted(() => {
  type Armed = { mockResolvedValue(value: unknown): unknown; mockReset(): unknown }
  const rearmers: Array<() => void> = []
  function armed<F extends Armed>(fn: F, value: unknown): F {
    fn.mockResolvedValue(value)
    rearmers.push(() => {
      fn.mockReset()
      fn.mockResolvedValue(value)
    })
    return fn
  }
  const mockVerifyAccessToken = vi.fn()
  const mockSelectResult = armed(vi.fn(), [])
  const mockInsertResult = armed(vi.fn(), [])
  const mockUpdateResult = armed(vi.fn(), [{ id: 'mock-id' }])
  const mockDeleteResult = armed(vi.fn(), [{ id: 'cat-1' }])
  const sinks = {
    insert: { value: undefined as unknown },
    update: { value: undefined as unknown },
    delete: { value: undefined as unknown },
  }
  return {
    mockVerifyAccessToken,
    mockSelectResult,
    mockInsertResult,
    mockUpdateResult,
    mockDeleteResult,
    sinks,
    rearmDbMockDefaults: () => {
      rearmers.forEach((rearm) => rearm())
      sinks.insert.value = undefined
      sinks.update.value = undefined
      sinks.delete.value = undefined
    },
  }
})

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn().mockResolvedValue({
    refreshed: 0,
    refreshFailed: 0,
    refreshSkipped: 0,
    healthChecked: 0,
    healthRecovered: 0,
  }),
}))
vi.mock('../src/services/relay-upstream-adapters.js', () => ({
  getRelayAdapter: vi.fn(() => null),
}))

vi.mock('../src/db/index.js', () => {
  function selectChain(): unknown {
    return new Proxy({} as Record<string, unknown>, {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop === 'then')
          return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            mockSelectResult().then(resolve, reject)
        return () => selectChain()
      },
    })
  }
  function writeChain(sink: { value: unknown }, resultMock: () => Promise<unknown>): unknown {
    const make = (): unknown =>
      new Proxy({} as Record<string, unknown>, {
        get(_t, prop) {
          if (typeof prop !== 'string') return undefined
          if (prop === 'then')
            return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              resultMock().then(resolve, reject)
          if (prop === 'returning') return () => make()
          if (prop === 'values' || prop === 'set')
            return (v: unknown) => {
              sink.value = v
              return make()
            }
          return () => make()
        },
      })
    return make()
  }
  return {
    db: {
      select: () => selectChain(),
      insert: () => writeChain(sinks.insert, () => mockInsertResult()),
      update: () => writeChain(sinks.update, () => mockUpdateResult()),
      delete: () => writeChain(sinks.delete, () => mockDeleteResult()),
      execute: vi.fn(async () => []),
    },
    dbRead: { select: () => selectChain() },
    dbClient: {},
  }
})

import relayAccountPoolRoutes from '../src/routes/admin/relay-account-pool.js'
import {
  resolveModelAlias,
  listModelCatalog,
  createModelCatalog,
  deleteModelCatalog,
} from '../src/services/relay-model-catalog.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const USER_TOKEN = 'Bearer user-token'

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  })
}

function mockRegularUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000002',
    phone: '13800000002',
    familyId: '00000000-0000-4000-8000-000000000003',
    roleId: 0,
  })
}

function catalogRow(over: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    providerCode: 'trae',
    upstreamModel: 'kimi-k2-0905-preview',
    displayName: 'Kimi K2',
    alias: 'kimi-k2',
    enabled: true,
    createdAt: new Date('2026-10-22T00:00:00Z'),
    updatedAt: new Date('2026-10-22T00:00:00Z'),
    ...over,
  }
}

describe('relay-model-catalog', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60000 })

  beforeEach(() => {
    rearmDbMockDefaults()
  })

  beforeAll(async () => {
    await server.register(relayAccountPoolRoutes, { prefix: '/api' })
    await server.ready()
  }, 60_000)

  afterAll(async () => {
    await server.close()
  })

  // ===========================================================================
  // 1. 服务层:resolveModelAlias
  // ===========================================================================
  describe('resolveModelAlias', () => {
    it('命中启用映射 → 返回 upstreamModel/displayName', async () => {
      mockSelectResult.mockResolvedValueOnce([
        { upstreamModel: 'kimi-k2-0905-preview', displayName: 'Kimi K2' },
      ])
      await expect(resolveModelAlias('trae', 'kimi-k2')).resolves.toEqual({
        upstreamModel: 'kimi-k2-0905-preview',
        displayName: 'Kimi K2',
      })
    })

    it('displayName 为空回退 upstreamModel', async () => {
      mockSelectResult.mockResolvedValueOnce([{ upstreamModel: 'glm-4.6', displayName: null }])
      await expect(resolveModelAlias('trae', 'glm')).resolves.toEqual({
        upstreamModel: 'glm-4.6',
        displayName: 'glm-4.6',
      })
    })

    it('无映射 → null(调用方原样透传)', async () => {
      mockSelectResult.mockResolvedValueOnce([])
      await expect(resolveModelAlias('trae', 'unknown-model')).resolves.toBeNull()
    })

    it('查询异常 → null(降级透传,永不抛)', async () => {
      mockSelectResult.mockRejectedValueOnce(new Error('db down'))
      await expect(resolveModelAlias('trae', 'kimi-k2')).resolves.toBeNull()
    })
  })

  // ===========================================================================
  // 2. 服务层:list / create / delete
  // ===========================================================================
  describe('listModelCatalog / createModelCatalog / deleteModelCatalog', () => {
    it('列表按 provider + alias 排序', async () => {
      mockSelectResult.mockResolvedValueOnce([
        catalogRow({ providerCode: 'workbuddy', alias: 'b' }),
        catalogRow({ providerCode: 'trae', alias: 'z' }),
        catalogRow({ providerCode: 'trae', alias: 'a' }),
      ])
      const rows = await listModelCatalog()
      expect(rows.map((r) => `${r.providerCode}/${r.alias}`)).toEqual([
        'trae/a',
        'trae/z',
        'workbuddy/b',
      ])
    })

    it('创建透传字段并回库行', async () => {
      mockInsertResult.mockResolvedValueOnce([catalogRow()])
      const row = await createModelCatalog({
        providerCode: 'trae',
        upstreamModel: 'kimi-k2-0905-preview',
        alias: 'kimi-k2',
        displayName: 'Kimi K2',
      })
      expect(row.id).toBe('cat-1')
      const values = sinks.insert.value as Record<string, unknown>
      expect(values.providerCode).toBe('trae')
      expect(values.alias).toBe('kimi-k2')
      expect(values.enabled).toBe(true)
    })

    it('删除命中返回 true,未命中返回 false', async () => {
      await expect(deleteModelCatalog('cat-1')).resolves.toBe(true)
      mockDeleteResult.mockResolvedValueOnce([])
      await expect(deleteModelCatalog('missing')).resolves.toBe(false)
    })
  })

  // ===========================================================================
  // 3. 管理面:GET /admin/relay/model-catalog
  // ===========================================================================
  describe('GET /api/admin/relay/model-catalog', () => {
    it('admin 返回目录列表', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([catalogRow()])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/model-catalog',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(1)
      expect(body.data.list[0].alias).toBe('kimi-k2')
      expect(body.data.total).toBe(1)
    })

    it('provider 过滤参数合法透传', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/model-catalog?provider=trae',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.list).toEqual([])
    })

    it('未登录 401 / 非管理员 403', async () => {
      const anon = await server.inject({ method: 'GET', url: '/api/admin/relay/model-catalog' })
      expect(anon.statusCode).toBe(401)
      mockRegularUser()
      const forbidden = await server.inject({
        method: 'GET',
        url: '/api/admin/relay/model-catalog',
        headers: { authorization: USER_TOKEN },
      })
      expect(forbidden.statusCode).toBe(403)
    })
  })

  // ===========================================================================
  // 4. 管理面:POST /admin/relay/model-catalog
  // ===========================================================================
  describe('POST /api/admin/relay/model-catalog', () => {
    it('创建成功 201', async () => {
      mockAdmin()
      mockInsertResult.mockResolvedValueOnce([catalogRow()])
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/model-catalog',
        body: {
          providerCode: 'trae',
          upstreamModel: 'kimi-k2-0905-preview',
          alias: 'kimi-k2',
          displayName: 'Kimi K2',
        },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.id).toBe('cat-1')
    })

    it('别名重复(PG 23505)→ 400', async () => {
      mockAdmin()
      mockInsertResult.mockImplementationOnce(() =>
        Promise.reject(Object.assign(new Error('duplicate key value'), { code: '23505' })),
      )
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/model-catalog',
        body: { providerCode: 'trae', upstreamModel: 'm', alias: 'kimi-k2' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toBe('该 provider 下别名已存在')
    })

    it('缺 alias → 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/model-catalog',
        body: { providerCode: 'trae', upstreamModel: 'm' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非管理员 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/relay/model-catalog',
        body: { providerCode: 'trae', upstreamModel: 'm', alias: 'a' },
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  // ===========================================================================
  // 5. 管理面:DELETE /admin/relay/model-catalog/:id
  // ===========================================================================
  describe('DELETE /api/admin/relay/model-catalog/:id', () => {
    it('删除成功回 deleted:true', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/relay/model-catalog/cat-1',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
      expect(body.data.id).toBe('cat-1')
    })

    it('条目不存在 → 404', async () => {
      mockAdmin()
      mockDeleteResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/relay/model-catalog/missing',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('未登录 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/relay/model-catalog/cat-1',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
