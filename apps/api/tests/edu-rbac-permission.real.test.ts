import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db, dbClient } from '../src/db/index.js'
import { users, roles, permissions, rolePermissions, userRoles } from '@ihui/database'
import {
  mockAuthenticate,
  setMockUser,
  setMockUnauthorized,
  resetMockAuth,
} from './helpers/mock-auth.js'

/**
 * 2026-08-30 教师角色 RBAC 测试 — 教务管理端点(requirePermission('edu:manage'))权限链路。
 *
 * 覆盖场景:
 *  1. 未登录访问教务 GET 端点 → 401
 *  2. 普通用户(roleId=0、无 RBAC 权限)→ 403
 *  3. admin(roleId=1)→ 豁免通过(RBAC 表为空也放行)
 *  4. 普通用户绑定 teacher 角色(持有 edu:manage 权限点)→ RBAC 三表 join 放行
 *     (测试内直接向 roles/permissions/role_permissions/user_roles 插数据)
 *  5. 持有乱造权限点(edu:other)的用户 → 403
 *
 * 测试目标端点:GET /api/edu-ai-management/term(学期列表,轻量,仅查 edu_term 表)。
 *
 * 说明:本文件需要真实 PostgreSQL(场景 4/5 需要真实三表 join,无法用 mock 验证),
 * 通过 DATABASE_URL 环境变量指向测试专用库运行,例如:
 *   $env:DATABASE_URL='postgresql://ihui:***@127.0.0.1:5432/ihui_rbac_test'
 *   npx vitest run tests/edu-rbac-permission.test.ts
 * 需要的表:users / roles / permissions / role_permissions / user_roles / edu_term。
 */

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const eduAiManagementRoutes = (await import('../src/routes/edu-ai-management.js')).default

/** 创建真实测试用户(满足 user_roles 外键约束),roleId=0 普通用户。 */
async function createUser(phone: string) {
  const [row] = await db
    .insert(users)
    .values({ phone, nickname: `RBAC测试用户-${phone}` })
    .returning()
  return row
}

describe('edu-rbac-permission — 教师角色 RBAC 权限链路(2026-08-30 教师角色 RBAC 测试)', () => {
  const server = Fastify({ logger: false })
  const TERM_URL = '/api/edu-ai-management/term'

  beforeAll(async () => {
    await server.register(eduAiManagementRoutes, { prefix: '/api/edu-ai-management' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
    // 关闭路由模块共享的 db 连接池,避免 vitest 因连接未释放而挂起
    await dbClient.end()
  })

  beforeEach(async () => {
    resetMockAuth()
    // 测试专用库,直接清空 RBAC/业务表保证用例隔离(users 级联清 user_roles)
    await db.execute(sql`DELETE FROM user_roles`)
    await db.execute(sql`DELETE FROM role_permissions`)
    await db.execute(sql`DELETE FROM roles`)
    await db.execute(sql`DELETE FROM permissions`)
    await db.execute(sql`DELETE FROM edu_term`)
    await db.execute(sql`DELETE FROM users`)
  })

  it('未登录访问教务 GET /term → 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: TERM_URL })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(401)
  })

  it('普通用户(roleId=0,无 RBAC 权限)→ 403', async () => {
    const user = await createUser('13800004000')
    setMockUser(user.id, 0)
    const res = await server.inject({ method: 'GET', url: TERM_URL })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.code).toBe(403)
    expect(body.message).toContain('权限')
  })

  it('admin(roleId=1)→ 豁免通过,RBAC 表为空也放行(非 403)', async () => {
    const admin = await createUser('13800004001')
    setMockUser(admin.id, 1)
    const res = await server.inject({ method: 'GET', url: TERM_URL })
    expect(res.statusCode).not.toBe(403)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    // 空表返回空列表
    expect(body.data.total).toBe(0)
    expect(body.data.list).toEqual([])
  })

  it('挂 edu:manage 权限点的 teacher 角色普通用户 → RBAC 三表 join 放行(非 403)', async () => {
    const teacher = await createUser('13800004002')
    // 直接向 RBAC 三表插数据:teacher 角色 → edu:manage 权限点 → 绑定用户
    const [role] = await db
      .insert(roles)
      .values({ name: 'teacher', displayName: '教师', scope: 'self', isSystem: false })
      .returning()
    const [perm] = await db
      .insert(permissions)
      .values({
        name: 'edu:manage',
        displayName: '教务管理',
        resource: 'edu',
        action: 'manage',
      })
      .returning()
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: perm.id })
    await db.insert(userRoles).values({ userId: teacher.id, roleId: role.id })

    // roleId=0,必须走 RBAC 校验路径
    setMockUser(teacher.id, 0)
    const res = await server.inject({ method: 'GET', url: TERM_URL })
    expect(res.statusCode).not.toBe(403)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
  })

  it('挂乱造权限点(edu:other)的用户 → 403', async () => {
    const attacker = await createUser('13800004003')
    const [role] = await db
      .insert(roles)
      .values({ name: 'fake-teacher', displayName: '伪教师', scope: 'self', isSystem: false })
      .returning()
    const [perm] = await db
      .insert(permissions)
      .values({
        name: 'edu:other',
        displayName: '乱造权限点',
        resource: 'edu',
        action: 'other',
      })
      .returning()
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: perm.id })
    await db.insert(userRoles).values({ userId: attacker.id, roleId: role.id })

    setMockUser(attacker.id, 0)
    const res = await server.inject({ method: 'GET', url: TERM_URL })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.code).toBe(403)
    expect(body.message).toContain('权限')
  })
})
