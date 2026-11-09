// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-169 教育证书详情缺归属校验 — 路由级夹具。
 *
 * 判据:证书详情与下载同为私有资源,非属主按「不存在」处理(404,与 download 及
 * 全仓属主闸同一口径,不泄露证书存在性);
 * 旧实现详情接口只查存在性,任何登录用户都能读他人证书 ⇒ 本文件「他人证书 404」用例必翻红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type * as CertificateQueries from '../src/db/certificate-queries.js'
import Fastify, { type FastifyInstance } from 'fastify'

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

const { mockVerifyAccessToken, mockFindCertificateById } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockFindCertificateById: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/index.js', () => {
  const chain = () => {
    const thenFn = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    const make = (): Record<string, unknown> => {
      const proxy = new Proxy({} as Record<string, unknown>, {
        get(_t, prop: string) {
          if (prop === 'then') return thenFn
          return vi.fn().mockReturnValue(make())
        },
      })
      return proxy
    }
    return make()
  }
  return {
    db: {
      select: vi.fn(() => chain()),
      insert: vi.fn(() => chain()),
      update: vi.fn(() => chain()),
      delete: vi.fn(() => chain()),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: vi.fn(() => chain()) },
  }
})

vi.mock('../src/db/certificate-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof CertificateQueries>()
  return { ...actual, findCertificateById: mockFindCertificateById }
})

import { eduFrontendRoutes } from '../src/routes/edu-frontend-routes.js'

const OWNER_ID = '00000000-0000-4000-8000-000000000002'
const OTHER_ID = '00000000-0000-4000-8000-000000000099'
const CERT_ID = '22222222-2222-4222-8222-222222222222'

describe('GET /api/edu/certificates/:id 归属闸(F-169)', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const e = err instanceof Error ? err : new Error(String(err))
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
    reply
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .send({ code: statusCode, message: statusCode >= 500 ? '服务器错误' : e.message })
  })

  beforeAll(async () => {
    await server.register(eduFrontendRoutes, { prefix: '/api' })
    await server.ready()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAccessToken.mockResolvedValue({
      userId: OWNER_ID,
      phone: '13800000002',
      familyId: '00000000-0000-4000-8000-000000000003',
      roleId: 0,
    })
  })

  afterAll(async () => {
    await server.close()
  })

  it('他人证书 → 404(按不存在处理),不回证书内容', async () => {
    mockFindCertificateById.mockResolvedValueOnce({
      id: CERT_ID,
      userId: OTHER_ID,
      title: '他人证书',
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/edu/certificates/${CERT_ID}`,
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json() as { data?: { certificate?: { title?: string } } }
    expect(body.data?.certificate).toBeUndefined()
  })

  it('本人证书 → 200 且返回证书', async () => {
    mockFindCertificateById.mockResolvedValueOnce({
      id: CERT_ID,
      userId: OWNER_ID,
      title: '我的证书',
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/edu/certificates/${CERT_ID}`,
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { certificate: { title: string } } }
    expect(body.data.certificate.title).toBe('我的证书')
  })

  it('证书不存在 → 404', async () => {
    mockFindCertificateById.mockResolvedValueOnce(undefined)
    const res = await server.inject({
      method: 'GET',
      url: `/api/edu/certificates/${CERT_ID}`,
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
