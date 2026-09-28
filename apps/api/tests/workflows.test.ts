// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { describe, it, expect, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入?env 校验触发 process.exit(1)
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

// 2026-09-27 布尔删除 ack 清账:补鉴权链与 workflow-queries 夹具,
// 让 DELETE /workflows/:id 的 deleted 由「命中集合」派生可测(钉删 0 行不得报 true)。
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

const { mockVerifyAccessToken, mockFindWorkflowById, mockDeleteWorkflow } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockFindWorkflowById: vi.fn(),
  mockDeleteWorkflow: vi.fn().mockResolvedValue([]),
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// authenticate() P2-14 查用户状态走 usercenter-queries,整模块 mock 避免触真库
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/workflow-queries.js', () => ({
  createWorkflow: vi.fn(),
  findWorkflows: vi.fn().mockResolvedValue([]),
  findWorkflowById: mockFindWorkflowById,
  updateWorkflow: vi.fn(),
  deleteWorkflow: mockDeleteWorkflow,
  createInstance: vi.fn(),
  findInstances: vi.fn().mockResolvedValue([]),
  findInstanceById: vi.fn(),
  updateInstanceStatus: vi.fn(),
  cancelInstance: vi.fn(),
  createTasks: vi.fn(),
  findTasks: vi.fn().mockResolvedValue([]),
  createLog: vi.fn(),
  findLogs: vi.fn().mockResolvedValue([]),
}))

import { workflowRoutes } from '../src/routes/workflows'

describe('workflow routes', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/workflows 未登录返?401', async () => {
    await server.register(workflowRoutes, { prefix: '/api' })
    await server.ready()

    const res = await server.inject({ method: 'GET', url: '/api/workflows' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/workflows 未登录返?401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/workflows',
      body: { name: 'wf', steps: [{}] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/workflows/instances 未登录返?401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/workflows/instances' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/workflows/instances/:id/cancel 未登录返?401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/workflows/instances/00000000-0000-4000-8000-000000000000/cancel',
    })
    expect(res.statusCode).toBe(401)
  })

  // ===========================================================================
  // 2026-09-27 布尔删除 ack 清账:DELETE /workflows/:id 的 deleted 必须由
  // deleteWorkflow 回报的 RETURNING 命中集派生 —— 钉"删 0 行不得报 deleted:true"。
  // ===========================================================================

  const OWNER = '00000000-0000-4000-8000-000000000001'

  function mockOwnerAuth() {
    mockVerifyAccessToken.mockResolvedValue({
      userId: OWNER,
      phone: '13900000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: 0,
    })
  }

  it('DELETE /api/workflows/:id — 库侧删 0 行不得报 deleted:true', async () => {
    mockOwnerAuth()
    mockFindWorkflowById.mockResolvedValue({ id: OWNER, createdBy: OWNER, name: 'wf', steps: [] })
    mockDeleteWorkflow.mockResolvedValue([])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/workflows/${OWNER}`,
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(false)
  })

  it('DELETE /api/workflows/:id — 删中 1 行回报 deleted:true', async () => {
    mockOwnerAuth()
    mockFindWorkflowById.mockResolvedValue({ id: OWNER, createdBy: OWNER, name: 'wf', steps: [] })
    mockDeleteWorkflow.mockResolvedValue([OWNER])
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/workflows/${OWNER}`,
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deleted).toBe(true)
  })
})
