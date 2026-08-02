/**
 * ai-generation IDOR 防护单元测试(2026-08-02 立)。
 *
 * 验证最近修复的 3 处 IDOR 漏洞:
 * - GET /ai/generation/:jobId/status — checkJobOwnership(owner !== currentUserId → 403)
 * - DELETE /ai/generation/:jobId — checkJobOwnership(owner !== currentUserId → 403)
 * - GET /ai/generation/user/:userId — URL userId !== jwt userId 且非 admin → 403
 *
 * 4 个核心场景覆盖每个端点:
 * - 场景 1:普通用户(roleId=0)访问他人 job → 403
 * - 场景 2:普通用户(roleId=0)访问自己 job → 200
 * - 场景 3:管理员(roleId=1)访问任意 job → 200(特权放行,不查 owner)
 * - 场景 4:无 token(未认证)→ 401
 *
 * 测试模式:vi.hoisted + vi.mock + Fastify inject(对齐 ai-callback.test.ts / agent-tasks.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3),本文件尽量用精确类型。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'
import Fastify from 'fastify'
import type { JWTPayload } from '@ihui/auth'

const {
  mockAuthenticate,
  mockGetJobOwner,
  mockGetStatus,
  mockCancel,
  mockListByUser,
  mockEnqueue,
  mockGetQueueStats,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockGetJobOwner: vi.fn(),
  mockGetStatus: vi.fn(),
  mockCancel: vi.fn(),
  mockListByUser: vi.fn(),
  mockEnqueue: vi.fn(),
  mockGetQueueStats: vi.fn(),
}))

// mock authenticate(避免触发 JWT 解析 + 真实 DB user 查询)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// mock generation-queue-service(避免触发 Redis/BullMQ 连接)
vi.mock('../src/services/ai/generation-queue-service.js', () => ({
  enqueue: mockEnqueue,
  getStatus: mockGetStatus,
  cancel: mockCancel,
  listByUser: mockListByUser,
  getJobOwner: mockGetJobOwner,
  getQueueStats: mockGetQueueStats,
}))

import aiGenerationRoutes from '../src/routes/ai-generation.js'

const USER_A = 'user-a-uuid'
const USER_B = 'user-b-uuid'
const JOB_ID = 'job-123'

/** 构造完整 JWTPayload(phone/familyId 在 ai-generation 路由未使用,给空串占位)。 */
function makePayload(userId: string, roleId: number): JWTPayload {
  return { userId, phone: '', familyId: '', roleId }
}

/** 模拟普通用户(roleId=0)。 */
function mockRegularUser(userId: string): void {
  mockAuthenticate.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 0)
  })
}

/** 模拟管理员(roleId=1,ADMIN_ROLE_ID = 1)。 */
function mockAdmin(userId: string): void {
  mockAuthenticate.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 1)
  })
}

/** 模拟未认证(authenticate 抛带 statusCode=401 的 Error,对齐 auth.ts 行为)。 */
function mockUnauthorized(): void {
  const err = new Error('Authentication required') as Error & { statusCode: number }
  err.statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

describe('ai-generation IDOR 防护', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(aiGenerationRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticate.mockReset()
    // 安全默认值:避免单个测试未设置 mock 时误触发真实逻辑
    mockGetJobOwner.mockResolvedValue(null)
    mockGetStatus.mockResolvedValue(null)
    mockCancel.mockResolvedValue(false)
    mockListByUser.mockResolvedValue([])
  })

  // ===== 场景 4:未认证 → 401(覆盖全部 3 个端点) =====
  describe('未认证访问 → 401', () => {
    it('GET /ai/generation/:jobId/status 未认证 → 401', async () => {
      mockUnauthorized()
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/${JOB_ID}/status`,
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().code).toBe(401)
      // 未认证不应触碰 service 层
      expect(mockGetJobOwner).not.toHaveBeenCalled()
      expect(mockGetStatus).not.toHaveBeenCalled()
    })

    it('DELETE /ai/generation/:jobId 未认证 → 401', async () => {
      mockUnauthorized()
      const res = await server.inject({
        method: 'DELETE',
        url: `/ai/generation/${JOB_ID}`,
      })
      expect(res.statusCode).toBe(401)
      expect(mockGetJobOwner).not.toHaveBeenCalled()
      expect(mockCancel).not.toHaveBeenCalled()
    })

    it('GET /ai/generation/user/:userId 未认证 → 401', async () => {
      mockUnauthorized()
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/user/${USER_A}`,
      })
      expect(res.statusCode).toBe(401)
      expect(mockListByUser).not.toHaveBeenCalled()
    })
  })

  // ===== GET /ai/generation/:jobId/status =====
  describe('GET /ai/generation/:jobId/status', () => {
    it('场景 1:普通用户访问他人 job → 403(权限拒绝,不查 status)', async () => {
      mockRegularUser(USER_A)
      mockGetJobOwner.mockResolvedValue(USER_B) // 他人拥有
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/${JOB_ID}/status`,
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe(403)
      expect(mockGetJobOwner).toHaveBeenCalledWith(JOB_ID)
      // IDOR 防护:权限拒绝在前,getStatus 不应被调用
      expect(mockGetStatus).not.toHaveBeenCalled()
    })

    it('场景 2:普通用户访问自己 job → 200', async () => {
      mockRegularUser(USER_A)
      mockGetJobOwner.mockResolvedValue(USER_A) // 自己拥有
      mockGetStatus.mockResolvedValue({
        jobId: JOB_ID,
        state: 'completed',
        progress: 100,
        result: { url: 'http://example.com/result.png' },
      })
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/${JOB_ID}/status`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.jobId).toBe(JOB_ID)
      expect(body.data.state).toBe('completed')
      expect(mockGetJobOwner).toHaveBeenCalledWith(JOB_ID)
      expect(mockGetStatus).toHaveBeenCalledWith(JOB_ID)
    })

    it('场景 3:管理员访问任何 job → 200(特权放行,不查 owner)', async () => {
      mockAdmin(USER_A)
      mockGetJobOwner.mockResolvedValue(USER_B) // 即使是他人拥有
      mockGetStatus.mockResolvedValue({
        jobId: JOB_ID,
        state: 'active',
        progress: 50,
        result: null,
      })
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/${JOB_ID}/status`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
      // admin 走特权路径,checkJobOwnership 提前 return true,不应调用 getJobOwner
      expect(mockGetJobOwner).not.toHaveBeenCalled()
      expect(mockGetStatus).toHaveBeenCalledWith(JOB_ID)
    })

    it('fail-closed:job 不存在(getJobOwner 返回 null)→ 403', async () => {
      mockRegularUser(USER_A)
      mockGetJobOwner.mockResolvedValue(null) // job 不存在或 data 无 userId
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/${JOB_ID}/status`,
      })
      // IDOR 防护 fail-closed:null owner 不允许访问
      expect(res.statusCode).toBe(403)
      expect(mockGetStatus).not.toHaveBeenCalled()
    })
  })

  // ===== DELETE /ai/generation/:jobId =====
  describe('DELETE /ai/generation/:jobId', () => {
    it('场景 1:普通用户取消他人 job → 403(权限拒绝,不调 cancel)', async () => {
      mockRegularUser(USER_A)
      mockGetJobOwner.mockResolvedValue(USER_B)
      const res = await server.inject({
        method: 'DELETE',
        url: `/ai/generation/${JOB_ID}`,
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe(403)
      expect(mockGetJobOwner).toHaveBeenCalledWith(JOB_ID)
      expect(mockCancel).not.toHaveBeenCalled()
    })

    it('场景 2:普通用户取消自己 job → 200', async () => {
      mockRegularUser(USER_A)
      mockGetJobOwner.mockResolvedValue(USER_A)
      mockCancel.mockResolvedValue(true)
      const res = await server.inject({
        method: 'DELETE',
        url: `/ai/generation/${JOB_ID}`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.canceled).toBe(true)
      expect(body.data.jobId).toBe(JOB_ID)
      expect(mockCancel).toHaveBeenCalledWith(JOB_ID)
    })

    it('场景 3:管理员取消任何 job → 200(特权放行,不查 owner)', async () => {
      mockAdmin(USER_A)
      mockGetJobOwner.mockResolvedValue(USER_B) // 即使是他人拥有
      mockCancel.mockResolvedValue(true)
      const res = await server.inject({
        method: 'DELETE',
        url: `/ai/generation/${JOB_ID}`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
      expect(mockGetJobOwner).not.toHaveBeenCalled()
      expect(mockCancel).toHaveBeenCalledWith(JOB_ID)
    })

    it('fail-closed:job 不存在(getJobOwner 返回 null)→ 403', async () => {
      mockRegularUser(USER_A)
      mockGetJobOwner.mockResolvedValue(null)
      const res = await server.inject({
        method: 'DELETE',
        url: `/ai/generation/${JOB_ID}`,
      })
      expect(res.statusCode).toBe(403)
      expect(mockCancel).not.toHaveBeenCalled()
    })
  })

  // ===== GET /ai/generation/user/:userId =====
  describe('GET /ai/generation/user/:userId', () => {
    it('普通用户访问他人任务列表(URL userId !== jwt userId)→ 403', async () => {
      mockRegularUser(USER_A) // jwt userId = USER_A
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/user/${USER_B}`, // URL 是 USER_B
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe(403)
      // 权限拒绝在前,listByUser 不应被调用
      expect(mockListByUser).not.toHaveBeenCalled()
    })

    it('普通用户访问自己任务列表(URL userId === jwt userId)→ 200', async () => {
      mockRegularUser(USER_A)
      mockListByUser.mockResolvedValue([])
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/user/${USER_A}`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(0)
      expect(body.data.list).toEqual([])
      expect(mockListByUser).toHaveBeenCalledWith(USER_A, undefined, 50)
    })

    it('管理员访问任意用户任务列表 → 200(特权放行)', async () => {
      mockAdmin(USER_A) // admin 自己是 USER_A
      mockListByUser.mockResolvedValue([])
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/user/${USER_B}`, // admin 看任意用户
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
      expect(mockListByUser).toHaveBeenCalledWith(USER_B, undefined, 50)
    })

    it('管理员访问时 listByUser query 参数透传(limit=10)', async () => {
      mockAdmin(USER_A)
      mockListByUser.mockResolvedValue([])
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/user/${USER_B}?limit=10`,
      })
      expect(res.statusCode).toBe(200)
      expect(mockListByUser).toHaveBeenCalledWith(USER_B, undefined, 10)
    })

    it('普通用户访问自己 + 携带 status 过滤 → 200(透传 status)', async () => {
      mockRegularUser(USER_A)
      mockListByUser.mockResolvedValue([])
      const res = await server.inject({
        method: 'GET',
        url: `/ai/generation/user/${USER_A}?status=completed`,
      })
      expect(res.statusCode).toBe(200)
      expect(mockListByUser).toHaveBeenCalledWith(USER_A, 'completed', 50)
    })
  })
})
