import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  mockAuthenticate,
  mockSelectResult,
  mockInsertReturning,
  mockUpdateReturning,
  mockDeleteReturning,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockInsertReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockUpdateReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockDeleteReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })) })),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockDeleteReturning })) })),
    transaction: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {
    select: vi.fn(() => createChainableMock()),
  },
  dbClient: {},
}))

import { frontendAdminRoutes as frontendStubAdminRoutes } from '../src/routes/admin-extended/index.js'
import { db } from '../src/db/index.js'

const PREFIX = '/api'
const ADMIN_USER = '00000000-0000-0000-0000-000000000001'
const REGULAR_USER = '00000000-0000-0000-0000-000000000002'
const TASK_ID = '33333333-3333-3333-3333-333333333333'
const AGENT_ID = '44444444-4444-4444-4444-444444444444'

function mockAdmin() {
  mockAuthenticate.mockImplementation(async (request: any) => {
    request.userId = ADMIN_USER
    request.jwtPayload = { userId: ADMIN_USER, roleId: 1 }
  })
}

function mockRegularUser() {
  mockAuthenticate.mockImplementation(async (request: any) => {
    request.userId = REGULAR_USER
    request.jwtPayload = { userId: REGULAR_USER, roleId: 0 }
  })
}

function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TASK_ID,
    agentId: AGENT_ID,
    ruleId: null,
    name: '测试任务',
    description: null,
    status: 'pending',
    priority: 0,
    payload: {},
    result: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('agent-tasks admin routes — /api/admin/agent-task/*', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(frontendStubAdminRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResult.mockReset()
    mockSelectResult.mockResolvedValue([])
    mockInsertReturning.mockReset()
    mockInsertReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockUpdateReturning.mockReset()
    mockUpdateReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockDeleteReturning.mockReset()
    mockDeleteReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockAuthenticate.mockReset()
  })

  it('非 admin 用户 POST /admin/agent-task 返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/agent-task`,
      payload: { agentId: AGENT_ID, name: '新任务' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('POST /admin/agent-task 创建成功 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([makeTask({ name: '新任务' })])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/agent-task`,
      payload: { agentId: AGENT_ID, name: '新任务' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('新任务')
    expect(db.insert).toHaveBeenCalled()
  })

  it('PUT /admin/agent-task/:id 更新成功 200', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([makeTask({ name: '更新后' })])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/agent-task/${TASK_ID}`,
      payload: { name: '更新后' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('更新后')
    expect(db.update).toHaveBeenCalled()
  })

  it('PUT /admin/agent-task/:id 不存在返回 404', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/agent-task/${TASK_ID}`,
      payload: { name: '更新后' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })

  it('DELETE /admin/agent-task/:id 删除成功 200', async () => {
    mockAdmin()
    mockDeleteReturning.mockResolvedValueOnce([makeTask()])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/agent-task/${TASK_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(db.delete).toHaveBeenCalled()
  })

  it('DELETE /admin/agent-task/:id 不存在返回 404', async () => {
    mockAdmin()
    mockDeleteReturning.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/agent-task/${TASK_ID}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /admin/agent-task 参数校验失败返回 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/agent-task`,
      payload: { name: '缺 agentId' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })
})
