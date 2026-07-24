import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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

const TOPIC_ID = '11111111-1111-1111-1111-111111111111'

vi.mock('../../db/learn-extended-queries.js', () => {
  const id = '11111111-1111-1111-1111-111111111111'
  const topic = {
    id,
    title: 'Topic',
    slug: 'topic',
    image: '',
    description: '',
    price: '0',
    originalPrice: '0',
    status: 'published',
    sort: 1,
    isShowIndex: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return {
    findAllTopics: vi.fn().mockResolvedValue({ list: [topic], total: 1, page: 1, pageSize: 20 }),
    findTopicRowById: vi
      .fn()
      .mockImplementation((tid: string) => Promise.resolve(tid === id ? topic : undefined)),
    createTopicRow: vi.fn().mockResolvedValue(topic),
    updateTopicRow: vi.fn().mockResolvedValue(topic),
    deleteTopicRow: vi.fn().mockResolvedValue(undefined),
  }
})

import { adminLearnRoutes } from '../learn.js'
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

describe('P0 Audit Gaps — Learn topic isShowIndex field', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminLearnRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/admin/learn/premium-topics accepts isShowIndex field', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/learn/premium-topics',
      payload: {
        title: 'New Topic',
        slug: 'new-topic',
        image: '',
        description: '',
        price: '0',
        originalPrice: '0',
        status: 'published',
        isShowIndex: false,
      },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe(0)
  })

  it('GET /api/admin/learn/premium-topics/:id returns isShowIndex field', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/learn/premium-topics/${TOPIC_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.code).toBe(0)
    expect(json.data.topic.isShowIndex).toBe(true)
  })

  it('PUT /api/admin/learn/premium-topics/:id updates isShowIndex', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/learn/premium-topics/${TOPIC_ID}`,
      payload: { isShowIndex: false },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
  })
})
