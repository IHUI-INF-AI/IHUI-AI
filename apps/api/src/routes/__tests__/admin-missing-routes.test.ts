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
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
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

import { adminMissingRoutes } from '../admin-missing-routes.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-admin-id',
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 1,
  })
}

describe('Admin Missing Routes — PUT /configs (upsert)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminMissingRoutes, { prefix: '/api/admin' })
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
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    )
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/configs',
      payload: { key: 'test_key', value: 'test_value' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('缺少 key 字段返回 400 参数错误', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/configs',
      headers: AUTH_HEADERS,
      payload: { value: 'test_value' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('缺少 value 字段返回 400 参数错误', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/configs',
      headers: AUTH_HEADERS,
      payload: { key: 'test_key' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('配置已存在时执行 update 并返回 200', async () => {
    const { db } = await import('../../db/index.js')
    const existingRow = { id: 'cfg-1', key: 'existing_key', value: 'old' }
    const updatedRow = { id: 'cfg-1', key: 'existing_key', value: 'new' }
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([existingRow]) }) }),
    } as never)
    vi.mocked(db.update).mockReturnValueOnce({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([updatedRow]) }),
      }),
    } as never)

    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/configs',
      headers: AUTH_HEADERS,
      payload: { key: 'existing_key', value: 'new_value' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.value).toBe('new')
    expect(db.update).toHaveBeenCalled()
  })

  it('配置不存在时执行 insert 并返回 201', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    } as never)
    const newRow = { id: 'cfg-2', key: 'new_key', value: 'new_value' }
    vi.mocked(db.insert).mockReturnValueOnce({
      values: () => ({ returning: () => Promise.resolve([newRow]) }),
    } as never)

    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/configs',
      headers: AUTH_HEADERS,
      payload: { key: 'new_key', value: 'new_value', category: 'general' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.key).toBe('new_key')
    expect(db.insert).toHaveBeenCalled()
  })

  it('GET /oss/files 无 auth 返回 401', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/admin/oss/files' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /roles 无 auth 返回 401', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/admin/roles' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /roles 无 auth 返回 401', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/roles',
      payload: { name: 'test_role' },
    })
    expect(res.statusCode).toBe(401)
  })
})
