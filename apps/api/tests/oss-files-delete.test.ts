import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockVerifyAccessToken, mockSelectResult } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('../src/db/oss-queries.js', () => ({
  findOssDrivers: vi.fn().mockResolvedValue([]),
  findOssDriverById: vi.fn().mockResolvedValue(undefined),
  findOssDriverByName: vi.fn().mockResolvedValue(undefined),
  createOssDriver: vi.fn(),
  updateOssDriver: vi.fn(),
  deleteOssDriver: vi.fn(),
  findDefaultOssDriver: vi.fn().mockResolvedValue(undefined),
  clearOtherDefaults: vi.fn().mockResolvedValue(undefined),
}))

import { ossRoutes } from '../src/routes/oss.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const OWNER_TOKEN = 'Bearer owner-token'
const OTHER_TOKEN = 'Bearer other-token'

const OWNER_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_ID = '00000000-0000-0000-0000-000000000002'
const FILE_URL = 'https://cdn.example.com/uploads/test.png'

function mockUser(userId: string, roleId: number) {
  mockVerifyAccessToken.mockResolvedValue({
    userId,
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId,
  })
}

describe('DELETE /api/oss/files (按 URL 软删)', () => {
  const server = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : err.message,
    })
  })

  beforeAll(async () => {
    await server.register(ossRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/oss/files',
      body: { url: FILE_URL },
    })
    expect(res.statusCode).toBe(401)
  })

  it('缺少 url 字段返回 400', async () => {
    mockUser(OWNER_ID, 0)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/oss/files',
      body: {},
      headers: { authorization: OWNER_TOKEN },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('url 为空字符串返回 400', async () => {
    mockUser(OWNER_ID, 0)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/oss/files',
      body: { url: '' },
      headers: { authorization: OWNER_TOKEN },
    })
    expect(res.statusCode).toBe(400)
  })

  it('本人删除自己的文件成功', async () => {
    mockUser(OWNER_ID, 0)
    mockSelectResult.mockResolvedValueOnce([{ id: 'file-1', uploadedBy: OWNER_ID, path: FILE_URL }])
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/oss/files',
      body: { url: FILE_URL },
      headers: { authorization: OWNER_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.deleted).toBe(true)
    expect(body.data.matched).toBe(true)
    expect(body.data.id).toBe('file-1')
  })

  it('管理员可删除他人文件', async () => {
    mockUser(OWNER_ID, 1)
    mockSelectResult.mockResolvedValueOnce([{ id: 'file-2', uploadedBy: OTHER_ID, path: FILE_URL }])
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/oss/files',
      body: { url: FILE_URL },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(true)
    expect(res.json().data.matched).toBe(true)
  })

  it('非本人非管理员删除返回 403', async () => {
    mockUser(OTHER_ID, 0)
    mockSelectResult.mockResolvedValueOnce([{ id: 'file-3', uploadedBy: OWNER_ID, path: FILE_URL }])
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/oss/files',
      body: { url: FILE_URL },
      headers: { authorization: OTHER_TOKEN },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
  })

  it('未匹配 DB 记录返回 matched:false', async () => {
    mockUser(OWNER_ID, 0)
    mockSelectResult.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/oss/files',
      body: { url: 'https://cdn.example.com/orphan.png' },
      headers: { authorization: OWNER_TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.matched).toBe(false)
    expect(body.data.deleted).toBe(false)
  })
})
