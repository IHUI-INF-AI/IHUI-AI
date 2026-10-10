// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-624 successor(2026-10-09):四个原走共享 idParamSchema(z.string().min(1))的路由
 * 收紧为本地 z.uuid() 后的行为断言。验收判据(照 G-624 票面):
 *  ① 塞 not-a-uuid 得 400(不再打到 PG uuid 列变 22P02 ⇒ 500);
 *  ② 合法 uuid 不误拒(通过校验进入正常执行路径)。
 * 底层列类型核验(2026-10-09 现读):roles.id / lesson_signups.id 为 uuid 主键,
 * edu_classes_members.class_id 为 uuid 外键 —— 共享 schema 保持原样(它还服务 serial 表)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'


const dbInsertQueue: unknown[][] = []
const dbUpdateQueue: unknown[][] = []

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(dbInsertQueue.shift() ?? [])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(dbUpdateQueue.shift() ?? [])),
        })),
      })),
    })),
    select: vi.fn(() => {
      throw new Error('g624 测试不覆盖 select 路径')
    }),
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  addUserRoleBatch: vi.fn().mockResolvedValue(1),
  removeUserRole: vi.fn().mockResolvedValue([]),
  removeUserRoleBatch: vi.fn().mockResolvedValue([]),
}))

import { roleRoutes } from '../src/routes/admin-extended/role-routes.js'
import { eduRoutes } from '../src/routes/admin-extended/edu-routes.js'

const UUID = '00000000-0000-4000-8000-0000000000ab'

describe('G-624 successor:uuid 参数守卫(400/不误拒)', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60000 })

  // 测试侧错误出口:与生产 errorHandler 同形,AppError 按 statusCode 出。
  // 判型用 statusCode 鸭子判(2026-10-09:instanceof 在 vitest 双模块图下不可靠)。
  server.setErrorHandler((err, _req, reply) => {
    const anyErr = err as { statusCode?: unknown; errorCode?: string }
    const status =
      typeof anyErr?.statusCode === 'number' && anyErr.statusCode >= 400 ? anyErr.statusCode : 500
    void reply.status(status).send({ statusCode: status, errorCode: anyErr?.errorCode })
  })

  beforeAll(async () => {
    await server.register(roleRoutes, { prefix: '/api' })
    await server.register(eduRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    dbInsertQueue.length = 0
    dbUpdateQueue.length = 0
    vi.clearAllMocks()
  })

  // ── ① not-a-uuid ⇒ 400 ──────────────────────────────────────────────
  it('POST /admin/roles/not-a-uuid/users ⇒ 400 VALIDATION_FAILED', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/roles/not-a-uuid/users',
      payload: { userId: UUID },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().errorCode).toBe('VALIDATION_FAILED')
  })

  it('POST /admin/edu/classes/not-a-uuid/members ⇒ 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu/classes/not-a-uuid/members',
      payload: { userId: UUID, role: 'student' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().errorCode).toBe('VALIDATION_FAILED')
  })

  it('POST /admin/learn/signup-batchlesson/not-a-uuid/retry ⇒ 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/learn/signup-batchlesson/not-a-uuid/retry',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().errorCode).toBe('VALIDATION_FAILED')
  })

  it('DELETE /admin/roles/not-a-uuid/users ⇒ 400', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/roles/not-a-uuid/users',
      payload: { userIds: [UUID] },
    })
    expect(res.statusCode).toBe(400)
  })

  // ── ② 合法 uuid 不误拒 ──────────────────────────────────────────────
  it('POST /admin/roles/<uuid>/users 通过校验进入执行路径 ⇒ 201', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/admin/roles/${UUID}/users`,
      payload: { userId: UUID },
    })
    expect(res.statusCode).toBe(201)
  })

  it('POST /admin/edu/classes/<uuid>/members 通过校验 ⇒ 201(插入路径真执行)', async () => {
    dbInsertQueue.push([{ id: UUID }])
    const res = await server.inject({
      method: 'POST',
      url: `/api/admin/edu/classes/${UUID}/members`,
      payload: { userId: UUID, role: 'student' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.created).toBe(true)
  })

  it('POST /admin/learn/signup-batchlesson/<uuid>/retry 通过校验 ⇒ 200', async () => {
    dbUpdateQueue.push([{ id: UUID, status: 1 }])
    const res = await server.inject({
      method: 'POST',
      url: `/api/admin/learn/signup-batchlesson/${UUID}/retry`,
    })
    expect(res.statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
