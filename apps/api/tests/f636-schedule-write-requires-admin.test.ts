// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-636(P1)交付测试:/api/schedule 的写端点必须过管理员闸。
 *
 * 三条契约:
 * 1. 普通登录用户 POST/PUT/DELETE/complete → 403「需要管理员权限」,且一个写库函数都没被调用;
 * 2. 管理员同一组端点 → 正常进入业务分支(201/200),与 adminScheduleRoutes 同口径(requireAdmin);
 * 3. 公共插件保留 GET:普通登录用户 GET /api/schedule → 200。
 *
 * 夹具的判定点放在"业务函数是否被调用"上 —— 旧实现(仅 checkAuth)会直接执行写库并返回
 * 2xx/200,本文件随之翻红。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

const {
  mockAuthenticate,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockRunNow,
  mockFindById,
  mockFindTasks,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockRunNow: vi.fn(),
  mockFindById: vi.fn(),
  mockFindTasks: vi.fn(),
}))

// Mock config 避免导入时 env 校验触发 process.exit(1);不写 ADMIN_TOTP_MODE ⇒ 解析为 off
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

// 鉴权打桩:凭 `x-test-role` 头区分 管理员 / 普通登录用户 / 未登录
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: vi.fn(),
  checkInternalServiceToken: vi.fn(),
  hasInternalServiceToken: vi.fn(() => false),
  checkAuth: async (
    request: { headers: Record<string, unknown> },
    reply: { status: (code: number) => { send: (body: unknown) => void } },
  ) => {
    try {
      await mockAuthenticate(request)
      return true
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send({ code: statusCode, message: (e as Error).message })
      return false
    }
  },
}))

// Mock schedule-queries 以隔离数据库依赖,并把"是否写库"钉成可断言
vi.mock('../src/db/schedule-queries.js', () => ({
  findScheduleTasks: mockFindTasks,
  findScheduleTaskById: mockFindById,
  createScheduleTask: mockCreate,
  updateScheduleTask: mockUpdate,
  deleteScheduleTask: mockDelete,
  setScheduleTaskEnabled: vi.fn(),
  runScheduleTaskNow: mockRunNow,
  findScheduleLogs: vi.fn(),
  findScheduleLogById: vi.fn(),
}))

import { scheduleRoutes } from '../src/routes/schedule'

const DUMMY_UUID = '00000000-0000-4000-8000-000000000001'

const CREATE_BODY = { name: '测试任务', cronExpression: '0 * * * *' }
const UPDATE_BODY = { name: '改名任务' }

type TestRequest = {
  headers: Record<string, unknown>
  userId?: string
  jwtPayload?: { userId: string; phone: string; familyId: string; roleId: number }
}

function asRole(role: 'admin' | 'user' | 'anon'): void {
  mockAuthenticate.mockImplementation(async (request: TestRequest) => {
    const header = request.headers['x-test-role']
    const effective = typeof header === 'string' && header !== '' ? header : role
    if (effective === 'anon') {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    }
    const isAdmin = effective === 'admin'
    request.userId = isAdmin ? 'u-admin' : 'u-user'
    request.jwtPayload = {
      userId: request.userId,
      phone: '',
      familyId: '',
      roleId: isAdmin ? 1 : 0,
    }
  })
}

describe('F-636 /api/schedule 写端点管理员闸', () => {
  const server = Fastify({ logger: false })

  beforeEach(async () => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ id: 'task-created', name: '测试任务' })
    mockUpdate.mockResolvedValue({ id: DUMMY_UUID, name: '改名任务' })
    mockDelete.mockResolvedValue([{ id: DUMMY_UUID }])
    mockRunNow.mockResolvedValue({ task: { id: DUMMY_UUID }, log: { id: 'log-1' } })
    mockFindById.mockResolvedValue({ id: DUMMY_UUID })
    mockFindTasks.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
    asRole('user')
  })

  afterAll(async () => {
    await server.close()
  })

  let booted = false

  async function boot(): Promise<void> {
    if (booted) return
    server.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await server.register(scheduleRoutes, { prefix: '/api' })
    await server.ready()
    booted = true
  }

  // ---- 普通登录用户:四个写端点一律 403,且不调用写库 ----

  it('普通用户 POST /api/schedule → 403,createScheduleTask 未被调用', async () => {
    await boot()
    asRole('user')
    const res = await server.inject({ method: 'POST', url: '/api/schedule', payload: CREATE_BODY })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('需要管理员权限')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('普通用户 PUT /api/schedule/:id → 403,updateScheduleTask 未被调用', async () => {
    await boot()
    asRole('user')
    const res = await server.inject({
      method: 'PUT',
      url: `/api/schedule/${DUMMY_UUID}`,
      payload: UPDATE_BODY,
    })
    expect(res.statusCode).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('普通用户 DELETE /api/schedule/:id → 403,deleteScheduleTask 未被调用', async () => {
    await boot()
    asRole('user')
    const res = await server.inject({ method: 'DELETE', url: `/api/schedule/${DUMMY_UUID}` })
    expect(res.statusCode).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('普通用户 POST /api/schedule/:id/complete → 403,runScheduleTaskNow 未被调用', async () => {
    await boot()
    asRole('user')
    const res = await server.inject({
      method: 'POST',
      url: `/api/schedule/${DUMMY_UUID}/complete`,
    })
    expect(res.statusCode).toBe(403)
    expect(mockRunNow).not.toHaveBeenCalled()
  })

  // ---- 管理员:同一组端点正常放行 ----

  it('管理员 POST /api/schedule → 201,且真正调用 createScheduleTask', async () => {
    await boot()
    asRole('admin')
    const res = await server.inject({ method: 'POST', url: '/api/schedule', payload: CREATE_BODY })
    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('管理员 PUT /api/schedule/:id → 200,且真正调用 updateScheduleTask', async () => {
    await boot()
    asRole('admin')
    const res = await server.inject({
      method: 'PUT',
      url: `/api/schedule/${DUMMY_UUID}`,
      payload: UPDATE_BODY,
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('管理员 DELETE /api/schedule/:id → 200,且真正调用 deleteScheduleTask', async () => {
    await boot()
    asRole('admin')
    const res = await server.inject({ method: 'DELETE', url: `/api/schedule/${DUMMY_UUID}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ deleted: true })
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('管理员 POST /api/schedule/:id/complete → 200,且真正调用 runScheduleTaskNow', async () => {
    await boot()
    asRole('admin')
    const res = await server.inject({
      method: 'POST',
      url: `/api/schedule/${DUMMY_UUID}/complete`,
    })
    expect(res.statusCode).toBe(200)
    expect(mockRunNow).toHaveBeenCalledTimes(1)
  })

  // ---- 公共插件保留 GET:登录即可读 ----

  it('普通登录用户 GET /api/schedule → 200(只读不受管理员闸影响)', async () => {
    await boot()
    asRole('user')
    const res = await server.inject({ method: 'GET', url: '/api/schedule' })
    expect(res.statusCode).toBe(200)
    expect(mockFindTasks).toHaveBeenCalledTimes(1)
  })

  it('未登录 POST /api/schedule → 401(插件级登录校验仍在)', async () => {
    await boot()
    asRole('anon')
    const res = await server.inject({ method: 'POST', url: '/api/schedule', payload: CREATE_BODY })
    expect(res.statusCode).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
