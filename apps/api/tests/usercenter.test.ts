// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

// Mock usercenter-queries 与 queries 以隔离数据库依赖
// 2026-09-27 布尔删除 ack 清账:委托函数的夹具返回值改为「命中集合」形态
// (旧夹具 mockResolvedValue(undefined) 只能配合"deleted:true 常量"活着;
//  路由现按 removed.length>0 派生,夹具必须能交/不交被删的那一行)。
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

const {
  mockVerifyAccessToken,
  mockGetUserStatus,
  mockFindUserById,
  mockFindDepartmentById,
  mockDeleteUser,
  mockDeleteDepartment,
  mockDeleteUserCertificate,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockGetUserStatus: vi.fn().mockResolvedValue(1),
  mockFindUserById: vi.fn(),
  mockFindDepartmentById: vi.fn(),
  mockDeleteUser: vi.fn().mockResolvedValue([]),
  mockDeleteDepartment: vi.fn().mockResolvedValue([]),
  mockDeleteUserCertificate: vi.fn().mockResolvedValue([]),
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  findUsers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  deleteUser: mockDeleteUser,
  updateUserPassword: vi.fn().mockResolvedValue(undefined),
  updateUserStatus: vi.fn().mockResolvedValue(undefined),
  // authenticate() P2-14 会查用户状态,缺这个导出整条鉴权链会炸
  getUserStatus: mockGetUserStatus,
  findDepartments: vi.fn().mockResolvedValue([]),
  findDepartmentById: mockFindDepartmentById,
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: mockDeleteDepartment,
  findUserCertificates: vi.fn().mockResolvedValue([]),
  createUserCertificate: vi.fn(),
  deleteUserCertificate: mockDeleteUserCertificate,
  getUserStatistics: vi.fn().mockResolvedValue({ total: 0, active: 0, disabled: 0, deptTotal: 0 }),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: mockFindUserById,
  findUserByPhone: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByAccount: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  saveRefreshToken: vi.fn().mockResolvedValue(undefined),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
}))

import { usercenterRoutes } from '../src/routes/usercenter'

const DUMMY_UUID = '00000000-0000-4000-8000-000000000001'

describe('usercenter routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // 与 server.ts 保持一致的错误处理器
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(usercenterRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  // 所有 usercenter 端点需管理员鉴权，未登录返回 401

  it('GET /api/admin/usercenter/users 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/usercenter/users' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/usercenter/statistics 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/usercenter/statistics' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/usercenter/departments 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/usercenter/departments' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/usercenter/users 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/usercenter/users',
      body: { phone: '13800000000', password: '123456' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/admin/usercenter/users/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/users/${DUMMY_UUID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/usercenter/users/:id/certificates 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/usercenter/users/${DUMMY_UUID}/certificates`,
    })
    expect(res.statusCode).toBe(401)
  })

  // ===========================================================================
  // 2026-09-27 布尔删除 ack 清账(1:1 用例):deleted 必须由委托层 RETURNING 命中集派生。
  // 钉"删 0 行不得报 deleted:true"——旧夹具喂 undefined 配合谎报,现夹具必须能交/不交
  // 被删的那一行(命中集合形态),期望值不放宽。
  // ===========================================================================

  const ADMIN_AUTH = { headers: { authorization: 'Bearer admin-token' } }

  function mockAdmin() {
    mockVerifyAccessToken.mockResolvedValue({
      userId: DUMMY_UUID,
      phone: '13800000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: 1,
    })
    mockGetUserStatus.mockResolvedValue(1)
  }

  it('DELETE /usercenter/users/:id — 库侧删 0 行不得报 deleted:true', async () => {
    mockAdmin()
    mockFindUserById.mockResolvedValue({ id: DUMMY_UUID, nickname: 'u' })
    mockDeleteUser.mockResolvedValue([])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/users/${DUMMY_UUID}`,
      ...ADMIN_AUTH,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.id).toBe(DUMMY_UUID)
    expect(body.data.deleted).toBe(false)
  })

  it('DELETE /usercenter/users/:id — 删中 1 行如实回报 deleted:true', async () => {
    mockAdmin()
    mockFindUserById.mockResolvedValue({ id: DUMMY_UUID, nickname: 'u' })
    mockDeleteUser.mockResolvedValue([DUMMY_UUID])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/users/${DUMMY_UUID}`,
      ...ADMIN_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(true)
  })

  it('DELETE /usercenter/certificates/:id — 删 0 行不得报 deleted:true', async () => {
    mockAdmin()
    mockDeleteUserCertificate.mockResolvedValue([])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/certificates/${DUMMY_UUID}`,
      ...ADMIN_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(false)
  })

  it('DELETE /usercenter/certificates/:id — 删中 1 行回报 deleted:true', async () => {
    mockAdmin()
    mockDeleteUserCertificate.mockResolvedValue([DUMMY_UUID])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/certificates/${DUMMY_UUID}`,
      ...ADMIN_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(true)
  })

  it('DELETE /usercenter/departments/:id — 删 0 行不得报 deleted:true', async () => {
    mockAdmin()
    mockFindDepartmentById.mockResolvedValue({ id: DUMMY_UUID, name: 'd' })
    mockDeleteDepartment.mockResolvedValue([])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/departments/${DUMMY_UUID}`,
      ...ADMIN_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(false)
  })

  it('DELETE /usercenter/departments/:id — 删中 1 行回报 deleted:true', async () => {
    mockAdmin()
    mockFindDepartmentById.mockResolvedValue({ id: DUMMY_UUID, name: 'd' })
    mockDeleteDepartment.mockResolvedValue([DUMMY_UUID])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/departments/${DUMMY_UUID}`,
      ...ADMIN_AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(true)
  })
})
