import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, eduOfflineRecords, eduUploadedCerts, eduUploadedPapers } from '@ihui/database'
import {
  mockAuthenticate,
  setMockUser,
  setMockUnauthorized,
  resetMockAuth,
} from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const { eduPublicRoutes } = await import('../src/routes/edu-public.js')

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

describe('edu-extended-routes — 线下记录/证书/论文 CRUD 需鉴权真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(eduPublicRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM edu_offline_records`)
    await db.execute(sql`DELETE FROM edu_uploaded_certs`)
    await db.execute(sql`DELETE FROM edu_uploaded_papers`)
    await db.execute(sql`DELETE FROM users`)
  })

  // =====================================================================
  // 线下学习记录 CRUD
  // =====================================================================

  it('GET /api/edu/my-offline-records — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-offline-records' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/edu/my-offline-records — 空表返回空列表', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-offline-records' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('GET /api/edu/my-offline-records — 按 userId 隔离', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await db.insert(eduOfflineRecords).values({
      userId: userA.id,
      type: '培训',
      title: 'A 的记录',
      hours: 8,
    })
    await db.insert(eduOfflineRecords).values({
      userId: userB.id,
      type: '会议',
      title: 'B 的记录',
      hours: 4,
    })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-offline-records' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('A 的记录')
  })

  it('POST /api/edu/offline-records — 成功创建', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/offline-records',
      body: { type: '培训', title: 'React 培训', hours: 16, description: '为期两天的 React 培训' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.title).toBe('React 培训')
    expect(body.data.record.type).toBe('培训')
    expect(body.data.record.hours).toBe(16)
    expect(body.data.record.userId).toBe(user.id)
  })

  it('POST /api/edu/offline-records — 缺 title 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/offline-records',
      body: { type: '培训' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT /api/edu/offline-records/:id — 成功更新', async () => {
    const user = await createUser('1001', '用户')
    const [record] = await db
      .insert(eduOfflineRecords)
      .values({ userId: user.id, type: '培训', title: '旧标题', hours: 4 })
      .returning()
    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/edu/offline-records/${record.id}`,
      body: { title: '新标题', hours: 8 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.record.title).toBe('新标题')
    expect(body.data.record.hours).toBe(8)
  })

  it('PUT /api/edu/offline-records/:id — 不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/edu/offline-records/00000000-0000-0000-0000-000000000000',
      body: { title: '新标题' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /api/edu/offline-records/:id — 更新他人记录返回 403', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const [record] = await db
      .insert(eduOfflineRecords)
      .values({ userId: userB.id, type: '培训', title: 'B 的记录', hours: 4 })
      .returning()
    setMockUser(userA.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/edu/offline-records/${record.id}`,
      body: { title: '篡改' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /api/edu/offline-records/:id — 成功删除', async () => {
    const user = await createUser('1001', '用户')
    const [record] = await db
      .insert(eduOfflineRecords)
      .values({ userId: user.id, type: '培训', title: '待删除', hours: 4 })
      .returning()
    setMockUser(user.id)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/edu/offline-records/${record.id}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('DELETE /api/edu/offline-records/:id — 删除他人记录返回 403', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const [record] = await db
      .insert(eduOfflineRecords)
      .values({ userId: userB.id, type: '培训', title: 'B 的记录', hours: 4 })
      .returning()
    setMockUser(userA.id)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/edu/offline-records/${record.id}`,
    })
    expect(res.statusCode).toBe(403)
  })

  // =====================================================================
  // 上传证书 CRUD
  // =====================================================================

  it('GET /api/edu/my-uploaded-certs — 空表返回空列表', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-uploaded-certs' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  it('POST /api/edu/uploaded-certs — 成功创建', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/uploaded-certs',
      body: { certName: 'AWS 认证', issuer: 'Amazon', certUrl: 'https://example.com/cert.pdf' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.cert.certName).toBe('AWS 认证')
    expect(body.data.cert.issuer).toBe('Amazon')
    expect(body.data.cert.status).toBe('pending')
    expect(body.data.cert.userId).toBe(user.id)
  })

  it('POST /api/edu/uploaded-certs — 缺 certName 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/uploaded-certs',
      body: { issuer: 'Amazon' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('DELETE /api/edu/uploaded-certs/:id — 成功删除', async () => {
    const user = await createUser('1001', '用户')
    const [cert] = await db
      .insert(eduUploadedCerts)
      .values({ userId: user.id, certName: '测试证书' })
      .returning()
    setMockUser(user.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/uploaded-certs/${cert.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('DELETE /api/edu/uploaded-certs/:id — 删除他人证书返回 403', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const [cert] = await db
      .insert(eduUploadedCerts)
      .values({ userId: userB.id, certName: 'B 的证书' })
      .returning()
    setMockUser(userA.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/uploaded-certs/${cert.id}` })
    expect(res.statusCode).toBe(403)
  })

  // =====================================================================
  // 论文/作业 CRUD
  // =====================================================================

  it('GET /api/edu/my-papers — 空表返回空列表', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-papers' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  it('POST /api/edu/papers — 成功创建', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/papers',
      body: { paperTitle: 'React 性能优化研究', paperUrl: 'https://example.com/paper.pdf' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.paper.paperTitle).toBe('React 性能优化研究')
    expect(body.data.paper.status).toBe('pending')
    expect(body.data.paper.userId).toBe(user.id)
  })

  it('POST /api/edu/papers — 缺 paperTitle 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/edu/papers',
      body: { paperUrl: 'https://example.com/paper.pdf' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('DELETE /api/edu/papers/:id — 成功删除', async () => {
    const user = await createUser('1001', '用户')
    const [paper] = await db
      .insert(eduUploadedPapers)
      .values({ userId: user.id, paperTitle: '测试论文' })
      .returning()
    setMockUser(user.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/papers/${paper.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('DELETE /api/edu/papers/:id — 删除他人论文返回 403', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const [paper] = await db
      .insert(eduUploadedPapers)
      .values({ userId: userB.id, paperTitle: 'B 的论文' })
      .returning()
    setMockUser(userA.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/papers/${paper.id}` })
    expect(res.statusCode).toBe(403)
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const user = await createUser('1001', '格式校验')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu/my-offline-records' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })
})
