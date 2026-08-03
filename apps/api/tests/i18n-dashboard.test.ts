import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'mock-admin-id', roleId: 1 }),
}))

const { mockDicts } = vi.hoisted(() => ({
  mockDicts: {
    'zh-CN': { greeting: '你好', farewell: '再见', welcome: '欢迎' },
    en: { greeting: 'Hello', farewell: 'Goodbye' },
    ja: { greeting: 'こんにちは', farewell: 'さようなら' },
    ko: { greeting: '안녕하세요', farewell: '안녕히 가세요' },
    'zh-TW': { greeting: '你好', farewell: '再見' },
  } as Record<string, Record<string, unknown>>,
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (filePath: string) => {
    const locale = String(filePath).match(/([a-zA-Z-]+)\.json$/)?.[1] ?? ''
    const dict = mockDicts[locale] ?? {}
    return Buffer.from(JSON.stringify(dict), 'utf8')
  }),
  stat: vi.fn(async () => ({ mtimeMs: 0, size: 0 })),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

import { i18nDashboardRoutes } from '../src/routes/i18n-dashboard'
import { verifyAccessToken } from '@ihui/auth'
import { getUserStatus } from '../src/db/usercenter-queries.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('i18n-dashboard routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(i18nDashboardRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('rejects unauthenticated request with 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/i18n-dashboard' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects non-admin user with 403', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({ userId: 'u1', roleId: 0 } as never)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/i18n-dashboard',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns overview with 5 languages and zh-CN at 100%', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({ userId: 'admin1', roleId: 1 } as never)
    vi.mocked(getUserStatus).mockResolvedValueOnce(1)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/i18n-dashboard',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.languages).toHaveLength(5)
    const zhCN = body.data.languages.find((l: { locale: string }) => l.locale === 'zh-CN')
    expect(zhCN.completion).toBe(100)
    expect(zhCN.missing).toBe(0)
    expect(body.data.totalMissing).toBeGreaterThanOrEqual(0)
  })

  it('compares two locales and returns entries', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({ userId: 'admin1', roleId: 1 } as never)
    vi.mocked(getUserStatus).mockResolvedValueOnce(1)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/i18n-dashboard/compare?left=zh-CN&right=en',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.entries)).toBe(true)
    expect(body.data.entries.length).toBeGreaterThan(0)
    expect(body.data.leftLocale).toBe('zh-CN')
    expect(body.data.rightLocale).toBe('en')
  })

  it('rejects unsupported locale in compare', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({ userId: 'admin1', roleId: 1 } as never)
    vi.mocked(getUserStatus).mockResolvedValueOnce(1)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/i18n-dashboard/compare?left=zh-CN&right=fr',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns missing keys list', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({ userId: 'admin1', roleId: 1 } as never)
    vi.mocked(getUserStatus).mockResolvedValueOnce(1)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/i18n-dashboard/missing?locale=en&pageSize=50',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.total).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(body.data.list)).toBe(true)
  })

  it('returns missing keys for all locales when locale=all', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({ userId: 'admin1', roleId: 1 } as never)
    vi.mocked(getUserStatus).mockResolvedValueOnce(1)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/i18n-dashboard/missing?locale=all',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.total).toBeGreaterThanOrEqual(0)
  })

  it('rejects cancelled user with 401', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      userId: 'cancelled-user',
      roleId: 1,
    } as never)
    vi.mocked(getUserStatus).mockResolvedValueOnce(3)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/i18n-dashboard',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(401)
  })
})
