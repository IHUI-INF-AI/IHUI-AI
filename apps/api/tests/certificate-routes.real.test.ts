import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, certificateTemplates, certificates } from '@ihui/database'
import {
  mockAuthenticate,
  setMockUser,
  setMockAdmin,
  setMockUnauthorized,
  resetMockAuth,
} from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const certificateRoutes = (await import('../src/routes/certificate.ts')).certificateRoutes
const adminCertificateRoutes = (await import('../src/routes/certificate.ts')).adminCertificateRoutes

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

async function createTemplate(data: { name: string; description?: string; status?: number }) {
  const [row] = await db
    .insert(certificateTemplates)
    .values({
      name: data.name,
      description: data.description,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

async function createCertificate(data: {
  userId: string
  title: string
  certificateNo?: string
  templateId?: string | null
  recipientName?: string | null
  status?: number
  source?: string
}) {
  const [row] = await db
    .insert(certificates)
    .values({
      userId: data.userId,
      title: data.title,
      certificateNo: data.certificateNo ?? `CERT-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      templateId: data.templateId ?? null,
      recipientName: data.recipientName ?? null,
      status: data.status ?? 1,
      source: data.source ?? 'manual',
    })
    .returning()
  return row
}

describe('certificate-routes — 证书需鉴权真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(certificateRoutes, { prefix: '/api' })
    await server.register(adminCertificateRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM certificates`)
    await db.execute(sql`DELETE FROM certificate_templates`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // 鉴权
  // =====================================================================

  it('GET /api/certificates/verify — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/certificates/verify?no=CERT-1' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/certificates/my — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/certificates/my' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/certificates/:id/download — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/certificates/00000000-0000-0000-0000-000000000000/download',
    })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // GET /api/certificates/verify
  // =====================================================================

  it('GET /api/certificates/verify — 缺 no 参数返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/certificates/verify' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/certificates/verify — 证书不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/certificates/verify?no=NOT-EXIST' })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/certificates/verify — 已撤销证书(status=0)返回 404', async () => {
    const user = await createUser('1001', '用户')
    const cert = await createCertificate({
      userId: user.id,
      title: '撤销证书',
      certificateNo: 'CERT-REVOKE-1',
      status: 0,
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: `/api/certificates/verify?no=${cert.certificateNo}` })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/certificates/verify — 有效证书返回 200 + 证书详情', async () => {
    const user = await createUser('1001', '用户')
    const cert = await createCertificate({
      userId: user.id,
      title: '优秀学员证书',
      certificateNo: 'CERT-OK-1',
      recipientName: '张三',
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: `/api/certificates/verify?no=${cert.certificateNo}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.certificate.id).toBe(cert.id)
    expect(body.data.certificate.title).toBe('优秀学员证书')
    expect(body.data.certificate.certificateNo).toBe('CERT-OK-1')
  })

  // =====================================================================
  // GET /api/certificates/my
  // =====================================================================

  it('GET /api/certificates/my — 返回当前用户证书列表', async () => {
    const user = await createUser('1001', '用户')
    await createCertificate({ userId: user.id, title: '证书1' })
    await createCertificate({ userId: user.id, title: '证书2' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/certificates/my' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(2)
  })

  it('GET /api/certificates/my — userId 隔离,不返回其他用户证书', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createCertificate({ userId: userA.id, title: 'A的证书' })
    await createCertificate({ userId: userB.id, title: 'B的证书' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/certificates/my' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('A的证书')
  })

  it('GET /api/certificates/my — 无证书返回空列表', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/certificates/my' })
    const body = res.json()
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  // =====================================================================
  // POST /api/certificates/:id/download
  // =====================================================================

  it('POST /api/certificates/:id/download — 证书不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/certificates/00000000-0000-0000-0000-000000000000/download',
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/certificates/:id/download — 非本人证书返回 403', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const cert = await createCertificate({ userId: userA.id, title: 'A的证书' })
    setMockUser(userB.id)
    const res = await server.inject({ method: 'POST', url: `/api/certificates/${cert.id}/download` })
    expect(res.statusCode).toBe(403)
  })

  it('POST /api/certificates/:id/download — 本人证书返回 PDF', async () => {
    const user = await createUser('1001', '用户')
    const cert = await createCertificate({
      userId: user.id,
      title: '我的证书',
      recipientName: '李四',
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'POST', url: `/api/certificates/${cert.id}/download` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('.pdf')
    // PDF 文件以 %PDF 开头
    expect(res.body.startsWith('%PDF')).toBe(true)
  })

  // =====================================================================
  // Admin: 鉴权
  // =====================================================================

  it('GET /api/admin/certificates/templates — 非 admin 返回 403', async () => {
    const user = await createUser('1001', '普通用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/certificates/templates' })
    expect(res.statusCode).toBe(403)
  })

  it('POST /api/admin/certificates/templates — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/certificates/templates',
      payload: { name: '模板' },
    })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // Admin: 模板 CRUD
  // =====================================================================

  it('POST /api/admin/certificates/templates — 创建模板返回 201', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/certificates/templates',
      payload: { name: '默认模板', description: '通用证书模板', status: 1 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.template.name).toBe('默认模板')
    expect(body.data.template.status).toBe(1)
  })

  it('POST /api/admin/certificates/templates — 缺 name 返回 400', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/certificates/templates',
      payload: { description: '无名称' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/admin/certificates/templates — 列表返回模板', async () => {
    const admin = await createUser('admin-1001', '管理员')
    await createTemplate({ name: '模板A' })
    await createTemplate({ name: '模板B' })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/certificates/templates' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)
  })

  it('GET /api/admin/certificates/templates — search 关键字筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    await createTemplate({ name: '优秀奖' })
    await createTemplate({ name: '结业证' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/certificates/templates?search=优秀',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].name).toBe('优秀奖')
  })

  it('GET /api/admin/certificates/templates/:id — 模板不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/certificates/templates/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/admin/certificates/templates/:id — 返回模板详情', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const tpl = await createTemplate({ name: '详情模板' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/certificates/templates/${tpl.id}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.template.id).toBe(tpl.id)
  })

  it('PUT /api/admin/certificates/templates/:id — 更新模板', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const tpl = await createTemplate({ name: '旧名称' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/certificates/templates/${tpl.id}`,
      payload: { name: '新名称', status: 0 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.template.name).toBe('新名称')
    expect(body.data.template.status).toBe(0)
  })

  it('PUT /api/admin/certificates/templates/:id — 模板不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/certificates/templates/00000000-0000-0000-0000-000000000000',
      payload: { name: 'x' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/admin/certificates/templates/:id — 删除模板', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const tpl = await createTemplate({ name: '待删除' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/certificates/templates/${tpl.id}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.ok).toBe(true)
  })

  it('DELETE /api/admin/certificates/templates/:id — 模板不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/certificates/templates/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  // =====================================================================
  // Admin: 证书 CRUD
  // =====================================================================

  it('POST /api/admin/certificates — 创建证书返回 201 + 自动生成编号', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const user = await createUser('1001', '学员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/certificates',
      payload: { userId: user.id, title: '管理员发放证书', recipientName: '王五' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.certificate.title).toBe('管理员发放证书')
    expect(body.data.certificate.certificateNo).toMatch(/^CERT-/)
    expect(body.data.certificate.userId).toBe(user.id)
  })

  it('POST /api/admin/certificates — 缺 userId 返回 400', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/certificates',
      payload: { title: '无用户' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/certificates — 非法 userId 返回 400', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/certificates',
      payload: { userId: 'not-a-uuid', title: '非法用户' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/admin/certificates — 列表返回证书', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const user = await createUser('1001', '学员')
    await createCertificate({ userId: user.id, title: '证书1' })
    await createCertificate({ userId: user.id, title: '证书2' })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/certificates' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)
  })

  it('GET /api/admin/certificates — userId 筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const userA = await createUser('1001', '学员A')
    const userB = await createUser('1002', '学员B')
    await createCertificate({ userId: userA.id, title: 'A证书' })
    await createCertificate({ userId: userB.id, title: 'B证书' })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: `/api/admin/certificates?userId=${userA.id}` })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].title).toBe('A证书')
  })

  it('GET /api/admin/certificates/:id — 证书不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/certificates/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/admin/certificates/:id — 返回证书详情', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const user = await createUser('1001', '学员')
    const cert = await createCertificate({ userId: user.id, title: '详情证书' })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: `/api/admin/certificates/${cert.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.certificate.id).toBe(cert.id)
  })

  it('PUT /api/admin/certificates/:id/status — 更新证书状态(撤销)', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const user = await createUser('1001', '学员')
    const cert = await createCertificate({ userId: user.id, title: '待撤销', status: 1 })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/certificates/${cert.id}/status`,
      payload: { status: 0 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.certificate.status).toBe(0)
  })

  it('PUT /api/admin/certificates/:id/status — 证书不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/certificates/00000000-0000-0000-0000-000000000000/status',
      payload: { status: 0 },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/admin/certificates/:id — 删除证书', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const user = await createUser('1001', '学员')
    const cert = await createCertificate({ userId: user.id, title: '待删除' })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/admin/certificates/${cert.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.ok).toBe(true)
    // 再次查询应 404
    const res2 = await server.inject({ method: 'GET', url: `/api/admin/certificates/${cert.id}` })
    expect(res2.statusCode).toBe(404)
  })

  it('DELETE /api/admin/certificates/:id — 证书不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/certificates/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })
})
