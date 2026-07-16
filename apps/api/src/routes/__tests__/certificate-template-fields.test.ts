import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

const TEMPLATE_ID = '11111111-1111-1111-1111-111111111111'

vi.mock('../../db/certificate-queries.js', () => {
  const id = '11111111-1111-1111-1111-111111111111'
  return {
    findTemplates: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findTemplateById: vi.fn().mockImplementation((tid: string) =>
      Promise.resolve(
        tid === id
          ? {
              id,
              name: 'Test Template',
              description: null,
              awardingOrganization: 'Org',
              awarderName: 'Awarder',
              awardConditions: 'Conditions',
              validityPolicy: 'one_year',
              backgroundImage: null,
              templateConfig: {},
              status: 1,
              createdAt: new Date().toISOString(),
            }
          : undefined,
      ),
    ),
    createTemplate: vi.fn().mockResolvedValue({ id }),
    updateTemplate: vi.fn().mockResolvedValue({ id }),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    findCertificates: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findCertificateById: vi.fn(),
    findCertificateByNo: vi.fn(),
    createCertificate: vi.fn(),
    updateCertificateStatus: vi.fn(),
    deleteCertificate: vi.fn(),
    generateCertificateNo: vi.fn().mockReturnValue('CERT-2026-0001'),
  }
})

import { certificateRoutes, adminCertificateRoutes } from '../certificate.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

function mockAuth(roleId = 1): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000000',
    phone: '13800000000',
    familyId: '00000000-0000-0000-0000-000000000000',
    roleId,
  })
}

describe('P0 Audit Gaps — Certificate template validityPolicy fields', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(certificateRoutes, { prefix: '/api' })
    await app.register(adminCertificateRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/admin/certificates/templates accepts validityPolicy and extended fields', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/certificates/templates',
      payload: {
        name: 'Advanced Template',
        awardingOrganization: 'Test Org',
        awarderName: 'Dr. Test',
        awardConditions: 'Pass the exam',
        validityPolicy: 'three_years',
        status: 1,
      },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(201)
    const json = res.json()
    expect(json.code).toBe(0)
    expect(json.data.template.id).toBe(TEMPLATE_ID)
  })

  it('GET /api/admin/certificates/templates/:id returns validityPolicy field', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/certificates/templates/${TEMPLATE_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.code).toBe(0)
    expect(json.data.template.validityPolicy).toBe('one_year')
    expect(json.data.template.awardingOrganization).toBe('Org')
    expect(json.data.template.awarderName).toBe('Awarder')
  })

  it('PUT /api/admin/certificates/templates/:id updates validityPolicy', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/certificates/templates/${TEMPLATE_ID}`,
      payload: { validityPolicy: 'permanent' },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
  })
})
