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
const BOT_ID = '55555555-5555-5555-5555-555555555555'
const SESSION_ID = '66666666-6666-6666-6666-666666666666'
const USER_ID = '77777777-7777-7777-7777-777777777777'

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

function makeBot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: BOT_ID,
    name: '测试机器人',
    description: null,
    avatar: null,
    systemPrompt: null,
    model: 'gpt-4o-mini',
    temperature: '0.7',
    maxTokens: 4096,
    isActive: true,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SESSION_ID,
    botId: BOT_ID,
    userId: USER_ID,
    title: '测试会话',
    status: 'active',
    messageCount: 0,
    lastMessageAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePermission(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'perm-1',
    botId: BOT_ID,
    userId: null,
    role: 'user',
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('clawdbot admin routes — /api/admin/clawdbot/*', () => {
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

  it('非 admin 用户 GET /admin/clawdbot/analytics/summary 返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/clawdbot/analytics/summary`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('GET /admin/clawdbot/analytics/summary 返回聚合统计 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([{ count: 5 }]) // botsTotal
      .mockResolvedValueOnce([{ count: 3 }]) // botsActive
      .mockResolvedValueOnce([{ count: 10 }]) // sessionsTotal
      .mockResolvedValueOnce([{ count: 2 }]) // permissionsTotal
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/clawdbot/analytics/summary`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.botsTotal).toBe(5)
    expect(body.data.botsActive).toBe(3)
    expect(body.data.sessionsTotal).toBe(10)
    expect(body.data.permissionsTotal).toBe(2)
  })

  it('POST /admin/clawdbot/bots 创建成功 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([makeBot({ name: '新机器人' })])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/clawdbot/bots`,
      payload: { name: '新机器人' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('新机器人')
    expect(db.insert).toHaveBeenCalled()
  })

  it('PUT /admin/clawdbot/bots/:id 更新成功 200', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([makeBot({ name: '更新后' })])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/clawdbot/bots/${BOT_ID}`,
      payload: { name: '更新后' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('更新后')
    expect(db.update).toHaveBeenCalled()
  })

  it('DELETE /admin/clawdbot/bots/:id 删除成功 200', async () => {
    mockAdmin()
    mockDeleteReturning.mockResolvedValueOnce([makeBot()])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/clawdbot/bots/${BOT_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(db.delete).toHaveBeenCalled()
  })

  it('GET /admin/clawdbot/permissions 返回权限列表 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([makePermission()]) // items
      .mockResolvedValueOnce([{ count: 1 }]) // total
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/clawdbot/permissions`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.total).toBe(1)
  })

  it('POST /admin/clawdbot/permissions 创建成功 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([makePermission({ role: 'admin' })])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/clawdbot/permissions`,
      payload: { botId: BOT_ID, role: 'admin' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.role).toBe('admin')
    expect(db.insert).toHaveBeenCalled()
  })

  it('GET /admin/clawdbot/sessions/:id 返回会话详情 200', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([makeSession()])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/clawdbot/sessions/${SESSION_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(SESSION_ID)
    expect(body.data.title).toBe('测试会话')
  })

  it('GET /admin/clawdbot/sessions/:id 不存在返回 404', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/clawdbot/sessions/${SESSION_ID}`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })

  it('GET /admin/clawdbot/bots 返回机器人列表 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([makeBot()]) // items
      .mockResolvedValueOnce([{ count: 1 }]) // total
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/clawdbot/bots`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.total).toBe(1)
  })

  it('GET /admin/clawdbot/stats 返回统计 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([{ count: 8 }]) // botsTotal
      .mockResolvedValueOnce([{ count: 4 }]) // botsActive
      .mockResolvedValueOnce([{ count: 15 }]) // sessionsTotal
      .mockResolvedValueOnce([{ count: 3 }]) // permissionsTotal
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/clawdbot/stats`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.botsTotal).toBe(8)
    expect(body.data.sessionsTotal).toBe(15)
  })

  it('DELETE /admin/clawdbot/permissions/:id 删除成功 200', async () => {
    mockAdmin()
    mockDeleteReturning.mockResolvedValueOnce([makePermission()])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/clawdbot/permissions/perm-1`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(db.delete).toHaveBeenCalled()
  })
})
