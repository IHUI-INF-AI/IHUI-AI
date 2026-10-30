// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

// 2026-08-06 修复:auth.ts P2-14 安全加固新增 getUserStatus 查询,
// mock 返回 status=1(active),避免 401 '用户不存在'
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// 修复(2026-07-24):authenticate 内部调用 jose.decodeJwt(token) 检查 challenge token,
// 'mock-admin-token' 非有效 JWT 会抛异常 → 401。mock decodeJwt 返回非 challenge payload 绕过。
vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/index.js', () => ({
  db: {},
}))

// 2026-08-30 角色权限点配置:mock rbac-queries,聚焦路由层鉴权/参数校验/全量替换逻辑
vi.mock('../../db/rbac-queries.js', () => ({
  findRoleById: vi.fn(),
  findPermissions: vi.fn(),
  findPermissionById: vi.fn(),
  findRolePermissions: vi.fn(),
  replaceRolePermissions: vi.fn(),
  checkAnyPermission: vi.fn(),
}))

import rolePermissionsRoutes from '../admin/role-permissions.js'
import { verifyAccessToken } from '@ihui/auth'
import {
  findRoleById,
  findPermissions,
  findPermissionById,
  findRolePermissions,
  replaceRolePermissions,
} from '../../db/rbac-queries.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }
// roles.id / permissions.id / role_permissions.role_id 都是 uuid:
//   packages/database/src/schema/rbac.ts:15(roles.id)、:31(permissions.id)、
//     :48-52(role_permissions.role_id / permission_id uuid NOT NULL)
//   DDL 0002_lucky_hiroim.sql:17-19 同形
// GET /role-permissions 在参数校验之后、进 SQL 之前挂 isUuidString 形状闸
// (src/routes/admin/role-permissions.ts:31,回 404),所以 'role-1' 这个假 id 让
// "返回角色已挂权限列表" 用例拿到 404 —— 断言 findRolePermissions 被喂什么也一并失效。
// 注:PUT /role-permissions 没有形状闸(只走 findRoleById 的存在性判断),所以
//   'role-404' / 'perm-404' 两枚"查不到"哨兵刻意保留原样 —— 它们表达的是 mock 返回
//   undefined 这一分支,不是 id 形状。
const ROLE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const PERM_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function mockAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-admin-id',
    phone: '13800000000',
    familyId: '11111111-1111-4111-8111-111111111111',
    roleId: 1,
  })
}

describe('Admin Role Permissions — 角色权限点配置(2026-08-30)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false, pluginTimeout: 120_000 })
    await app.register(rolePermissionsRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminAuth()
  })

  it('无 auth 返回 401', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    )
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/role-permissions?roleId=${ROLE_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('非管理员(roleId=0)返回 403', async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: 'mock-user-id',
      phone: '13800000000',
      familyId: '11111111-1111-4111-8111-111111111111',
      roleId: 0,
    })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: ROLE_ID, permissionIds: [PERM_ID] },
    })
    expect(res.statusCode).toBe(403)
  })

  it('GET 缺 roleId 返回 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('PUT 缺 roleId 返回 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { permissionIds: [PERM_ID] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('GET /role-permissions 返回角色已挂权限列表', async () => {
    vi.mocked(findRolePermissions).mockResolvedValue([{ id: PERM_ID, name: 'edu:view' }] as never)
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/role-permissions?roleId=${ROLE_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(findRolePermissions).toHaveBeenCalledWith(ROLE_ID)
  })

  it('GET /permissions 返回全部权限点列表', async () => {
    vi.mocked(findPermissions).mockResolvedValue([
      { id: PERM_ID, name: 'edu:view' },
      { id: 'perm-2', name: 'edu:manage' },
    ] as never)
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/permissions',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toHaveLength(2)
  })

  it('PUT 角色不存在返回 404', async () => {
    vi.mocked(findRoleById).mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: 'role-404', permissionIds: [PERM_ID] },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('角色不存在')
  })

  it('PUT 存在未知权限 ID 返回 404', async () => {
    vi.mocked(findRoleById).mockResolvedValue({ id: ROLE_ID } as never)
    vi.mocked(findPermissionById).mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: ROLE_ID, permissionIds: ['perm-404'] },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('存在未知的权限 ID')
  })

  it('PUT 成功全量替换(去重)并返回最新列表', async () => {
    vi.mocked(findRoleById).mockResolvedValue({ id: ROLE_ID } as never)
    vi.mocked(findPermissionById).mockResolvedValue({ id: PERM_ID } as never)
    vi.mocked(replaceRolePermissions).mockResolvedValue(undefined)
    vi.mocked(findRolePermissions).mockResolvedValue([{ id: PERM_ID, name: 'edu:view' }] as never)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: ROLE_ID, permissionIds: [PERM_ID, PERM_ID] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.roleId).toBe(ROLE_ID)
    expect(body.data.list).toHaveLength(1)
    // 重复 permissionIds 去重后传入替换函数
    expect(replaceRolePermissions).toHaveBeenCalledWith(ROLE_ID, [PERM_ID])
  })

  it('PUT 空数组清空角色权限', async () => {
    vi.mocked(findRoleById).mockResolvedValue({ id: ROLE_ID } as never)
    vi.mocked(replaceRolePermissions).mockResolvedValue(undefined)
    vi.mocked(findRolePermissions).mockResolvedValue([] as never)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: ROLE_ID, permissionIds: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(replaceRolePermissions).toHaveBeenCalledWith(ROLE_ID, [])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
