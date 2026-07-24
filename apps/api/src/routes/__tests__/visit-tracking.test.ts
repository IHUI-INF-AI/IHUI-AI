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

vi.mock('../../db/index.js', () => {
  function createChain(result: unknown[] = []): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
      groupBy: () => chain,
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

import { adminVisitTrackingRoutes } from '../visit-tracking.js'
import { verifyAccessToken } from '@ihui/auth'
import { db } from '../../db/index.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-admin-id',
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 1,
  })
}

function mockNoAuth(): void {
  vi.mocked(verifyAccessToken).mockRejectedValue(
    Object.assign(new Error('Authentication required'), { statusCode: 401 }),
  )
}

describe('Visit Tracking — GET /traces/slow-queries', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminVisitTrackingRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminAuth()
  })

  it('无 auth 返回 401', async () => {
    mockNoAuth()
    const res = await app.inject({ method: 'GET', url: '/api/admin/traces/slow-queries' })
    expect(res.statusCode).toBe(401)
  })

  it('pg_stat_activity 查询成功返回慢查询列表', async () => {
    const mockSlowQueries = [
      {
        pid: 12345,
        usename: 'ihui_user',
        application_name: 'api-server',
        client_addr: '127.0.0.1',
        duration: '00:00:05.123',
        state: 'active',
        query: 'SELECT * FROM users WHERE ...',
      },
      {
        pid: 12346,
        usename: 'ihui_user',
        application_name: 'api-server',
        client_addr: '10.0.0.1',
        duration: '00:00:03.456',
        state: 'active',
        query: 'UPDATE orders SET ...',
      },
    ]
    vi.mocked(db.execute).mockResolvedValueOnce(mockSlowQueries as never)

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/traces/slow-queries',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list[0].pid).toBe(12345)
    expect(body.data.list[0].query).toContain('SELECT')
    expect(body.data.total).toBe(2)
    expect(body.data.note).toContain('pg_stat_activity')
  })

  it('无慢查询时返回空列表', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as never)

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/traces/slow-queries',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('pg_stat_activity 不可用时返回空列表与说明 note', async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('permission denied') as never)

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/traces/slow-queries',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
    expect(body.data.note).toContain('pg_stat_activity')
    expect(body.data.note).toContain('不可用')
  })

  it('IP 黑名单添加/列表/删除流程', async () => {
    const addRes = await app.inject({
      method: 'POST',
      url: '/api/admin/visit-tracking/ip-blacklist',
      headers: AUTH_HEADERS,
      payload: { ip: '192.168.1.100', reason: 'abuse', ttlSeconds: 3600 },
    })
    expect(addRes.statusCode).toBe(200)
    expect(addRes.json().data.entry.ip).toBe('192.168.1.100')

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/visit-tracking/ip-blacklist',
      headers: AUTH_HEADERS,
    })
    expect(listRes.statusCode).toBe(200)
    const listBody = listRes.json()
    expect(listBody.data.list).toHaveLength(1)
    expect(listBody.data.list[0].ip).toBe('192.168.1.100')

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/admin/visit-tracking/ip-blacklist/192.168.1.100',
      headers: AUTH_HEADERS,
    })
    expect(delRes.statusCode).toBe(200)
    expect(delRes.json().data.removed).toBe(true)

    const listRes2 = await app.inject({
      method: 'GET',
      url: '/api/admin/visit-tracking/ip-blacklist',
      headers: AUTH_HEADERS,
    })
    expect(listRes2.json().data.list).toHaveLength(0)
  })

  it('删除不存在的 IP 返回 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/visit-tracking/ip-blacklist/10.0.0.999',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toContain('不在黑名单中')
  })
})
