// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 134 第二格:写结果 ack 必须由库侧 RETURNING 派生(2026-10-22)。
 *
 * 三条被人工核查判为「返回 updated 但并未真正写入/无法证明写入」的端点:
 *   ① PUT /api/admin/developer/coze/:id/status —— 表无 status 列,整趟不发写 ⇒ 不得回 updated:true;
 *   ② PUT /api/auth/user-sk/:skId —— update 补 .returning({id}),updated 由命中行数派生;
 *   ③ PUT /api/admin/learn/lessons/:id/exam-paper —— upsert 的 update/insert 均补 .returning,
 *      updated 由返回行数派生(响应键名不变);
 *   ④ PUT /api/auth/password —— updated 由委托侧 updateUser(UPDATE … RETURNING)的行存在性派生,
 *      委托零命中抛错时不得回出 updated:true 的成功信封。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:8811/0'
})

const mocks = vi.hoisted(() => ({
  updateUserSk: vi.fn(),
  setLessonExamPaperId: vi.fn(),
  setLessonCertificateId: vi.fn(),
  findUserById: vi.fn(),
  updateUser: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    authenticate: async (request: { userId?: string }) => {
      request.userId = 'g134-user'
    },
  }
})

vi.mock('../src/plugins/require-permission.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, requireAdmin: async () => {} }
})

vi.mock('../src/db/oauth-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, updateUserSk: mocks.updateUserSk }
})

vi.mock('../src/db/learn-extended-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    setLessonExamPaperId: mocks.setLessonExamPaperId,
    setLessonCertificateId: mocks.setLessonCertificateId,
  }
})

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findUserById: mocks.findUserById,
    updateUser: mocks.updateUser,
    revokeAllUserRefreshTokens: mocks.revokeAllUserRefreshTokens,
  }
})

vi.mock('../src/utils/password-crypto.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    hashPassword: vi.fn().mockResolvedValue('hashed-new'),
    verifyPassword: vi.fn().mockResolvedValue(true),
  }
})

import { authRoutes } from '../src/routes/auth.js'
import { authExtendedRoutes } from '../src/routes/auth-extended.js'
import { adminLearnRoutes } from '../src/routes/learn.js'
import systemLoginLogsRoutes from '../src/routes/admin/system-login-logs.js'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'
const PAPER_ID = '22222222-2222-4222-8222-222222222222'

describe('G-134 updated ack 由库侧 RETURNING 派生', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.register(adminLearnRoutes, { prefix: '/api/admin' })
    await app.register(systemLoginLogsRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PUT /api/auth/user-sk/:skId 无匹配行 ⇒ updated=false', async () => {
    mocks.updateUserSk.mockResolvedValue([])
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/user-sk/sk-miss',
      payload: { status: 1 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
    expect(mocks.updateUserSk).toHaveBeenCalledWith('sk-miss', 'g134-user', 1)
  })

  it('PUT /api/auth/user-sk/:skId 有匹配行 ⇒ updated=true', async () => {
    mocks.updateUserSk.mockResolvedValue([{ id: 'sk-hit' }])
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/user-sk/sk-hit',
      payload: { status: 0 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
    expect(mocks.updateUserSk).toHaveBeenCalledWith('sk-hit', 'g134-user', 0)
  })

  it('PUT /api/admin/learn/lessons/:id/exam-paper 的 updated 取 RETURNING 行数(有行/无行两档)', async () => {
    mocks.setLessonExamPaperId.mockResolvedValue([{ id: 'assoc-1' }])
    const hit = await app.inject({
      method: 'PUT',
      url: `/api/admin/learn/lessons/${LESSON_ID}/exam-paper`,
      payload: { examPaperId: PAPER_ID },
    })
    expect(hit.statusCode).toBe(200)
    expect(hit.json().data.updated).toBe(true)

    mocks.setLessonExamPaperId.mockResolvedValue([])
    const miss = await app.inject({
      method: 'PUT',
      url: `/api/admin/learn/lessons/${LESSON_ID}/exam-paper`,
      payload: { examPaperId: null },
    })
    expect(miss.statusCode).toBe(200)
    expect(miss.json().data.updated).toBe(false)
  })

  it('PUT /api/admin/developer/coze/:id/status 不发写 ⇒ 不再回 updated:true', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/developer/coze/42/status',
      payload: { status: 1 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).not.toHaveProperty('updated')
  })

  it('PUT /api/auth/password 委托 RETURNING 命中行 ⇒ updated=true', async () => {
    mocks.findUserById.mockResolvedValue({ id: 'g134-user', passwordHash: 'old-hash' })
    mocks.updateUser.mockResolvedValue({ id: 'g134-user' })
    mocks.revokeAllUserRefreshTokens.mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/password',
      payload: { oldPassword: 'old123', newPassword: 'new123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })

  it('PUT /api/auth/password 委托零命中(UPDATE … RETURNING 取不到行)⇒ 不回 updated:true', async () => {
    mocks.findUserById.mockResolvedValue({ id: 'g134-user', passwordHash: 'old-hash' })
    mocks.updateUser.mockRejectedValue(new Error('更新用户失败'))
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/password',
      payload: { oldPassword: 'old123', newPassword: 'new123' },
    })
    expect(res.statusCode).toBe(500)
    expect((res.json() as { data?: { updated?: boolean } }).data?.updated).not.toBe(true)
  })
})
