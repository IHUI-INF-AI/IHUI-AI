// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-570 已撤销证书仍可由本人下载 PDF — 路由级夹具。
 *
 * 判据:POST /api/certificates/:id/download 与 GET /api/certificates/verify 同口径,
 * status !== 1(0=已撤销)必须 404 且不生成 PDF;旧实现只校验归属,
 * 本人下载已撤销证书仍回 200 + application/pdf ⇒ 「已撤销 404」用例必翻红。
 * 同时保留 F-169 归属闸回归(他人证书仍 403)。
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

const { mockCheckAuth, mockFindCertificateById } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(),
  mockFindCertificateById: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
  authenticate: vi.fn(),
  requireActiveUser: vi.fn(),
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

import { certificateRoutes } from '../src/routes/certificate.js'

const OWNER_ID = '00000000-0000-4000-8000-000000000002'
const OTHER_ID = '00000000-0000-4000-8000-000000000099'
const CERT_ID = '22222222-2222-4222-8222-222222222222'

function certOf(userId: string, status: number) {
  return {
    id: CERT_ID,
    userId,
    title: '测试证书',
    certificateNo: 'CERT-570-001',
    recipientName: '张三',
    issuedAt: new Date('2026-01-01T00:00:00Z'),
    status,
  }
}

describe('POST /api/certificates/:id/download 撤销闸(F-570)', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const e = err instanceof Error ? err : new Error(String(err))
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
    reply
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .send({ code: statusCode, message: statusCode >= 500 ? '服务器错误' : e.message })
  })

  beforeAll(async () => {
    await server.register(certificateRoutes, { prefix: '/api' })
    await server.ready()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAuth.mockImplementation(async (request: { userId?: string }) => {
      request.userId = OWNER_ID
      return true
    })
  })

  afterAll(async () => {
    await server.close()
  })

  it('本人 + status=0(已撤销) → 404 且不产出 PDF', async () => {
    mockFindCertificateById.mockResolvedValueOnce(certOf(OWNER_ID, 0))
    const res = await server.inject({
      method: 'POST',
      url: `/api/certificates/${CERT_ID}/download`,
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json() as { code?: number; message?: string }
    expect(body.code).toBe(404)
    expect(body.message).toBe('证书已失效')
    expect(res.headers['content-type']).not.toContain('application/pdf')
    expect(res.headers['content-disposition']).toBeUndefined()
    expect(res.body.startsWith('%PDF') || res.rawPayload.subarray(0, 4).toString() === '%PDF').toBe(
      false,
    )
  })

  it('本人 + status=1(有效) → 200 且返回 PDF', async () => {
    mockFindCertificateById.mockResolvedValueOnce(certOf(OWNER_ID, 1))
    const res = await server.inject({
      method: 'POST',
      url: `/api/certificates/${CERT_ID}/download`,
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('.pdf')
    expect(res.rawPayload.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('他人 + status=1 → 403(归属闸回归)', async () => {
    mockFindCertificateById.mockResolvedValueOnce(certOf(OTHER_ID, 1))
    const res = await server.inject({
      method: 'POST',
      url: `/api/certificates/${CERT_ID}/download`,
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(403)
    const body = res.json() as { code?: number; message?: string }
    expect(body.message).toBe('无权下载此证书')
    expect(res.headers['content-type']).not.toContain('application/pdf')
  })
})
