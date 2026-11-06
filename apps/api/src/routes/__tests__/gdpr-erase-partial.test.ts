// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_ID = '44444444-4444-4444-8444-444444444444'

const h = vi.hoisted(() => ({
  findUserById: vi.fn(),
  purgeUserPii: vi.fn(),
  clearSearchHistory: vi.fn(),
  addAuditLog: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({ db: {} }))
vi.mock('../../db/queries.js', () => ({ findUserById: h.findUserById }))
vi.mock('../../services/purge-user-pii.js', () => ({ purgeUserPii: h.purgeUserPii }))
vi.mock('../../db/search-queries.js', () => ({
  findSearchHistory: vi.fn(async () => []),
  findAuditLogs: vi.fn(async () => ({ list: [] })),
  addAuditLog: h.addAuditLog,
  clearSearchHistory: h.clearSearchHistory,
}))
vi.mock('../../plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = USER_ID
  },
}))

import { gdprRoutes } from '../gdpr.js'

describe('GDPR /erase — 未删干净不得宣称已擦除(T-6)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(gdprRoutes, { prefix: '/api/gdpr' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    h.findUserById.mockResolvedValue({ id: USER_ID, status: 1 })
    h.purgeUserPii.mockResolvedValue(undefined)
    h.clearSearchHistory.mockResolvedValue(undefined)
    h.addAuditLog.mockResolvedValue(undefined)
  })

  const erase = () => app.inject({ method: 'POST', url: '/api/gdpr/erase' })

  it('搜索历史清理失败:erased=false + partial=true + failedSteps,审计记 partial', async () => {
    h.clearSearchHistory.mockRejectedValue(new Error('search table locked'))

    const res = await erase()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.erased).toBe(false)
    expect(body.data.partial).toBe(true)
    expect(body.data.failedSteps).toEqual(['searchHistory'])

    expect(h.addAuditLog).toHaveBeenCalledTimes(1)
    const audit = h.addAuditLog.mock.calls[0]?.[0] as {
      details: { outcome: string; failedSteps: string[]; anonymized: boolean }
    }
    expect(audit.details.outcome).toBe('partial')
    expect(audit.details.failedSteps).toEqual(['searchHistory'])
    expect(audit.details.anonymized).toBe(true)
  })

  it('PII 主流程失败:500,绝不回 erased=true,审计记 failed 且 anonymized=false', async () => {
    h.purgeUserPii.mockRejectedValue(new Error('anonymize failed'))

    const res = await erase()
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.json())).not.toContain('"erased":true')

    expect(h.addAuditLog).toHaveBeenCalledTimes(1)
    const audit = h.addAuditLog.mock.calls[0]?.[0] as {
      details: { outcome: string; anonymized: boolean; status: unknown }
    }
    expect(audit.details.outcome).toBe('failed')
    expect(audit.details.anonymized).toBe(false)
    expect(audit.details.status).toBeNull()
  })

  it('全部成功:erased=true + partial=false,审计记 completed', async () => {
    const res = await erase()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toMatchObject({ erased: true, partial: false, failedSteps: [] })
    expect(h.addAuditLog).toHaveBeenCalledTimes(1)
    const audit = h.addAuditLog.mock.calls[0]?.[0] as { details: { outcome: string } }
    expect(audit.details.outcome).toBe('completed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
