// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-107 回归锁(2026-11-11)。
 *
 * 缺陷:POST /ai/generation/enqueue 把 body 的 userId 原样入队,未与 JWT 主体比对,
 *      登录用户可冒用他人身份写任务归属(影响状态/取消 IDOR 判定、用户任务列表、计费口径)。
 * 判据:无论 body 是否携带 userId、调用方是否管理员,入队数据的 userId 必须等于鉴权主体;
 *      priority/dedupeWindowMs 仍是独立入参,不得混进 job data。
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

// mock authenticate(避免 JWT 解析 + 真实 DB)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// mock generation-queue-service(避免真实 Redis/BullMQ 连接)
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
const JOB_ID = 'job-107'

/** 构造完整 JWTPayload(ai-generation 路由未使用 phone/familyId,给空串占位)。 */
function makePayload(userId: string, roleId: number): JWTPayload {
  return { userId, phone: '', familyId: '', roleId }
}

function mockUser(userId: string, roleId = 0): void {
  mockAuthenticate.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, roleId)
  })
}

function mockUnauthorized(): void {
  const err = new Error('Authentication required') as Error & { statusCode: number }
  err.statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

/** 合法的入队 body(minus userId)。 */
function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taskId: 'task-107',
    type: 'text',
    prompt: 'hello',
    modelId: 'model-x',
    params: { temperature: 0.5 },
    ...overrides,
  }
}

/** 取唯一一次入队调用的 job data。 */
function enqueuedData(): Record<string, unknown> {
  expect(mockEnqueue).toHaveBeenCalledTimes(1)
  return mockEnqueue.mock.calls[0]![0] as Record<string, unknown>
}

describe('F-107 生成队列入队归属', () => {
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
    mockEnqueue.mockResolvedValue(JOB_ID)
    mockGetJobOwner.mockResolvedValue(null)
    mockGetStatus.mockResolvedValue(null)
    mockCancel.mockResolvedValue(false)
    mockListByUser.mockResolvedValue({ jobs: [], total: 0 })
  })

  async function postEnqueue(body: Record<string, unknown>) {
    return server.inject({
      method: 'POST',
      url: '/ai/generation/enqueue',
      payload: body,
    })
  }

  it('body 冒用他人 userId → 入队归属仍是鉴权主体', async () => {
    mockUser(USER_A)
    const res = await postEnqueue(validBody({ userId: USER_B }))
    expect(res.statusCode).toBe(202)
    expect(res.json().code).toBe(0)
    expect(enqueuedData().userId).toBe(USER_A)
    expect(enqueuedData().userId).not.toBe(USER_B)
  })

  it('body 不带 userId → 仍可入队,归属取鉴权主体', async () => {
    mockUser(USER_A)
    const res = await postEnqueue(validBody())
    expect(res.statusCode).toBe(202)
    expect(enqueuedData().userId).toBe(USER_A)
  })

  it('管理员也不能代填归属(本仓无代调用语义)→ 归属仍是自己', async () => {
    mockUser(USER_A, 1)
    const res = await postEnqueue(validBody({ userId: USER_B }))
    expect(res.statusCode).toBe(202)
    expect(enqueuedData().userId).toBe(USER_A)
  })

  it('未认证 → 401 且不触碰队列', async () => {
    mockUnauthorized()
    const res = await postEnqueue(validBody({ userId: USER_B }))
    expect(res.statusCode).toBe(401)
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('其余字段原样入队,priority/dedupeWindowMs 保持独立入参', async () => {
    mockUser(USER_A)
    const res = await postEnqueue(
      validBody({ userId: USER_B, priority: 'high', dedupeWindowMs: 60_000 }),
    )
    expect(res.statusCode).toBe(202)
    const data = enqueuedData()
    expect(data).toMatchObject({
      taskId: 'task-107',
      type: 'text',
      prompt: 'hello',
      modelId: 'model-x',
      params: { temperature: 0.5 },
      userId: USER_A,
    })
    expect(data).not.toHaveProperty('priority')
    expect(data).not.toHaveProperty('dedupeWindowMs')
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A }), 'high', 60_000)
  })

  it('参数非法(缺 taskId)→ 400 且不触碰队列', async () => {
    mockUser(USER_A)
    const body = validBody()
    delete body.taskId
    const res = await postEnqueue(body)
    expect(res.statusCode).toBe(400)
    expect(mockEnqueue).not.toHaveBeenCalled()
  })
})
