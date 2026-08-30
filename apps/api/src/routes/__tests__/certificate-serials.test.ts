import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken, mockSelectResult, mockInsertValues, mockUpdateResult } = vi.hoisted(
  () => ({
    mockVerifyAccessToken: vi.fn(),
    mockSelectResult: vi.fn().mockResolvedValue([]),
    mockInsertValues: vi.fn().mockResolvedValue([]),
    mockUpdateResult: vi.fn().mockResolvedValue([]),
  }),
)

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/index.js', () => {
  const make = () => {
    const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }

  const dbMock = {
    select: vi.fn(() => make()),
    insert: vi.fn(() => ({
      values: vi.fn((vals: Record<string, unknown>) => ({
        returning: () => mockInsertValues(vals),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: () => mockUpdateResult(),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(async (cb: (tx: { select: unknown; insert: unknown }) => Promise<unknown>) =>
      cb({ select: dbMock.select, insert: dbMock.insert }),
    ),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { certificateSerialsRoutes } from '../certificate-serials.js'

const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const CERT_ID = '00000000-0000-4000-8000-000000000020'
const SERIAL_ID = '00000000-0000-4000-8000-000000000010'
const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: ADMIN_ID,
    roleId: 1,
    type: 'access',
  })
}

function makeCertificate() {
  return {
    id: CERT_ID,
    templateId: null,
    userId: 'user-1',
    certificateNo: 'CERT-20260831-XYZ12345',
    title: '优秀学员证书',
    recipientName: '张三',
    source: 'manual',
    sourceId: null,
    issuer: null,
    score: null,
    validDays: null,
    issuedAt: new Date(),
    status: 1,
    createdAt: new Date(),
  }
}

function makeSerial(overrides: Record<string, unknown> = {}) {
  return {
    id: SERIAL_ID,
    certificateId: CERT_ID,
    serialNumber: 'IHUI-20260831-AB12CD34',
    issuedTo: '张三',
    issuedAt: new Date(),
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  }
}

describe('Certificate Serials API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _req, reply) => {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
      reply.status(statusCode).send({ code: statusCode, message: (err as Error).message })
    })
    await app.register(certificateSerialsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockAdmin()
    mockSelectResult.mockReset()
    mockInsertValues.mockReset()
    mockUpdateResult.mockReset()
    mockSelectResult.mockResolvedValue([])
    mockInsertValues.mockResolvedValue([])
    mockUpdateResult.mockResolvedValue([])
  })

  describe('POST /api/certificate-serials/issue', () => {
    it('颁发成功 — 序列号格式正确且状态为 active', async () => {
      mockSelectResult.mockResolvedValueOnce([makeCertificate()])
      mockInsertValues.mockResolvedValueOnce([makeSerial()])

      const res = await app.inject({
        method: 'POST',
        url: '/api/certificate-serials/issue',
        headers: AUTH_HEADERS,
        payload: { certificateId: CERT_ID, holderName: '张三' },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.serialNumber).toMatch(/^IHUI-\d{8}-[A-Z0-9]{8}$/)
      expect(body.data.status).toBe('active')
    })

    it('重复序列号冲突(23505)时自动重试并最终成功', async () => {
      mockSelectResult.mockResolvedValueOnce([makeCertificate()])
      mockInsertValues
        .mockRejectedValueOnce({ code: '23505' })
        .mockResolvedValueOnce([makeSerial()])

      const res = await app.inject({
        method: 'POST',
        url: '/api/certificate-serials/issue',
        headers: AUTH_HEADERS,
        payload: { certificateId: CERT_ID },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.serialNumber).toMatch(/^IHUI-\d{8}-[A-Z0-9]{8}$/)
      // 重试逻辑至少调用了 2 次 insert
      expect(mockInsertValues).toHaveBeenCalledTimes(2)
    })

    it('连续 3 次唯一冲突后返回 500', async () => {
      mockSelectResult.mockResolvedValueOnce([makeCertificate()])
      mockInsertValues.mockRejectedValue({ code: '23505' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/certificate-serials/issue',
        headers: AUTH_HEADERS,
        payload: { certificateId: CERT_ID },
      })

      expect(res.statusCode).toBe(500)
      expect(mockInsertValues).toHaveBeenCalledTimes(3)
    })

    it('证书不存在返回 404', async () => {
      mockSelectResult.mockResolvedValueOnce([])

      const res = await app.inject({
        method: 'POST',
        url: '/api/certificate-serials/issue',
        headers: AUTH_HEADERS,
        payload: { certificateId: '00000000-0000-4000-8000-000000000099' },
      })

      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.message).toBe('证书不存在')
    })

    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Authentication required'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/certificate-serials/issue',
        payload: { certificateId: CERT_ID },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /api/certificate-serials', () => {
    it('列表分页返回序列号及证书信息', async () => {
      mockSelectResult
        .mockResolvedValueOnce([
          {
            serial: makeSerial(),
            certificateNo: 'CERT-20260831-XYZ12345',
            certificateTitle: '优秀学员证书',
          },
        ])
        .mockResolvedValueOnce([{ count: 1 }])

      const res = await app.inject({
        method: 'GET',
        url: '/api/certificate-serials?page=1&pageSize=20',
        headers: AUTH_HEADERS,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.items).toHaveLength(1)
      expect(body.data.total).toBe(1)
      expect(body.data.items[0].serialNumber).toBe('IHUI-20260831-AB12CD34')
      expect(body.data.items[0].certificateTitle).toBe('优秀学员证书')
    })

    it('按 status 筛选只查询指定状态', async () => {
      mockSelectResult
        .mockResolvedValueOnce([{ serial: makeSerial({ status: 'revoked' }) }])
        .mockResolvedValueOnce([{ count: 1 }])

      const res = await app.inject({
        method: 'GET',
        url: '/api/certificate-serials?status=revoked',
        headers: AUTH_HEADERS,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data.items[0].status).toBe('revoked')
    })
  })

  describe('POST /api/certificate-serials/:id/revoke', () => {
    it('撤销成功 — status 变为 revoked', async () => {
      mockUpdateResult.mockResolvedValueOnce([makeSerial({ status: 'revoked' })])

      const res = await app.inject({
        method: 'POST',
        url: '/api/certificate-serials/00000000-0000-4000-8000-000000000010/revoke',
        headers: AUTH_HEADERS,
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.serial.status).toBe('revoked')
    })

    it('序列号不存在返回 404', async () => {
      mockUpdateResult.mockResolvedValueOnce([])

      const res = await app.inject({
        method: 'POST',
        url: '/api/certificate-serials/00000000-0000-4000-8000-000000000099/revoke',
        headers: AUTH_HEADERS,
      })

      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.message).toBe('序列号不存在')
    })
  })

  describe('GET /api/certificate-serials/verify', () => {
    it('验真成功 — 返回状态与归属信息', async () => {
      mockSelectResult
        .mockResolvedValueOnce([makeSerial({ issuedTo: '李四' })])
        .mockResolvedValueOnce([makeCertificate()])

      const res = await app.inject({
        method: 'GET',
        url: '/api/certificate-serials/verify?serialNumber=IHUI-20260831-AB12CD34',
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.serialNumber).toBe('IHUI-20260831-AB12CD34')
      expect(body.data.status).toBe('active')
      expect(body.data.holderName).toBe('李四')
      expect(body.data.certificateTitle).toBe('优秀学员证书')
    })

    it('验真未找到返回 404', async () => {
      mockSelectResult.mockResolvedValueOnce([])

      const res = await app.inject({
        method: 'GET',
        url: '/api/certificate-serials/verify?serialNumber=IHUI-00000000-NOTFOUND0',
      })

      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.message).toBe('序列号不存在')
    })

    it('缺少 serialNumber 参数返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/certificate-serials/verify',
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
