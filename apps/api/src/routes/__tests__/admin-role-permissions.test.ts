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
      url: '/api/admin/role-permissions?roleId=role-1',
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
      payload: { roleId: 'role-1', permissionIds: ['perm-1'] },
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
      payload: { permissionIds: ['perm-1'] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('GET /role-permissions 返回角色已挂权限列表', async () => {
    vi.mocked(findRolePermissions).mockResolvedValue([{ id: 'perm-1', name: 'edu:view' }] as never)
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/role-permissions?roleId=role-1',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(findRolePermissions).toHaveBeenCalledWith('role-1')
  })

  it('GET /permissions 返回全部权限点列表', async () => {
    vi.mocked(findPermissions).mockResolvedValue([
      { id: 'perm-1', name: 'edu:view' },
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
      payload: { roleId: 'role-404', permissionIds: ['perm-1'] },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('角色不存在')
  })

  it('PUT 存在未知权限 ID 返回 404', async () => {
    vi.mocked(findRoleById).mockResolvedValue({ id: 'role-1' } as never)
    vi.mocked(findPermissionById).mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: 'role-1', permissionIds: ['perm-404'] },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('存在未知的权限 ID')
  })

  it('PUT 成功全量替换(去重)并返回最新列表', async () => {
    vi.mocked(findRoleById).mockResolvedValue({ id: 'role-1' } as never)
    vi.mocked(findPermissionById).mockResolvedValue({ id: 'perm-1' } as never)
    vi.mocked(replaceRolePermissions).mockResolvedValue(undefined)
    vi.mocked(findRolePermissions).mockResolvedValue([{ id: 'perm-1', name: 'edu:view' }] as never)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: 'role-1', permissionIds: ['perm-1', 'perm-1'] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.roleId).toBe('role-1')
    expect(body.data.list).toHaveLength(1)
    // 重复 permissionIds 去重后传入替换函数
    expect(replaceRolePermissions).toHaveBeenCalledWith('role-1', ['perm-1'])
  })

  it('PUT 空数组清空角色权限', async () => {
    vi.mocked(findRoleById).mockResolvedValue({ id: 'role-1' } as never)
    vi.mocked(replaceRolePermissions).mockResolvedValue(undefined)
    vi.mocked(findRolePermissions).mockResolvedValue([] as never)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/role-permissions',
      headers: AUTH_HEADERS,
      payload: { roleId: 'role-1', permissionIds: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(replaceRolePermissions).toHaveBeenCalledWith('role-1', [])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
