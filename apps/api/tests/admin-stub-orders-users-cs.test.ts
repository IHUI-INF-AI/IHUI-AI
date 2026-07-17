import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  mockAuthenticate,
  mockSelectResult,
  mockInsertReturning,
  mockUpdateReturning,
  mockDeleteReturning,
  mockCreateComment,
  mockFindTicketById,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockInsertReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockUpdateReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockDeleteReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockCreateComment: vi.fn(),
  mockFindTicketById: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/db/customer-service-queries.js', () => ({
  createComment: mockCreateComment,
  findTicketById: mockFindTicketById,
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
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockDeleteReturning })) })),
    transaction: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {
    select: vi.fn(() => createChainableMock()),
  },
  dbClient: {},
}))

import { frontendStubAdminRoutes } from '../src/routes/frontend-stub-admin-routes.js'
import { db } from '../src/db/index.js'

const PREFIX = '/api'
const ADMIN_USER = '00000000-0000-0000-0000-000000000001'
const REGULAR_USER = '00000000-0000-0000-0000-000000000002'
const USER_ID = '11111111-1111-1111-1111-111111111111'
const ORDER_ID = '22222222-2222-2222-2222-222222222222'
const TICKET_ID = '33333333-3333-3333-3333-333333333333'
const COMMENT_ID = '44444444-4444-4444-4444-444444444444'

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

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: USER_ID,
    phone: '13800000001',
    email: 'u@example.com',
    username: 'u1',
    nickname: '默认昵称',
    avatar: null,
    bio: null,
    gender: 0,
    birthday: null,
    familyId: null,
    roleId: 0,
    deptId: null,
    status: 1,
    isVip: 0,
    level: 0,
    isSystemAdmin: false,
    inviteCode: 'inv-1',
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ORDER_ID,
    orderNo: 'O202607170001',
    userId: USER_ID,
    orderType: 'course',
    targetId: 'c1',
    targetTitle: '课程标题',
    quantity: 1,
    originalPrice: '100.00',
    discountAmount: '0.00',
    payAmount: '100.00',
    payType: 'alipay',
    status: 'pending',
    payTime: null,
    cancelTime: null,
    refundTime: null,
    remark: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeTicket(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TICKET_ID,
    ticketNo: 'CS2026071700001',
    userId: USER_ID,
    title: '工单标题',
    description: '工单描述',
    status: 'open',
    priority: 'medium',
    source: 'web',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('admin stub routes — users / orders / customer-service', () => {
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
    mockCreateComment.mockReset()
    mockFindTicketById.mockReset()
  })

  // ---------- PUT /admin/users/:id ----------

  it('PUT /admin/users/:id — 未登录返回 401', async () => {
    mockAuthenticate.mockImplementation(async () => {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    })
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/users/${USER_ID}`,
      payload: { nickname: 'new' },
    })
    expect(res.statusCode).toBe(401)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('PUT /admin/users/:id — 非 admin 返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/users/${USER_ID}`,
      payload: { nickname: 'new' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('PUT /admin/users/:id — 不存在返回 404', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/users/${USER_ID}`,
      payload: { nickname: '新昵称' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(db.update).toHaveBeenCalled()
  })

  it('PUT /admin/users/:id — 成功更新白名单字段 200', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([makeUser({ nickname: '新昵称', level: 2 })])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/users/${USER_ID}`,
      payload: { nickname: '新昵称', level: 2, bio: '简介' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.nickname).toBe('新昵称')
    expect(body.data.level).toBe(2)
    expect(db.update).toHaveBeenCalled()
  })

  it('PUT /admin/users/:id — 黑名单字段 email 被严格模式拒绝 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/users/${USER_ID}`,
      payload: { email: 'hacker@evil.com' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('PUT /admin/users/:id — 黑名单字段 phone 被严格模式拒绝 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/users/${USER_ID}`,
      payload: { phone: '13888888888' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  // ---------- PUT /admin/orders/:id ----------

  it('PUT /admin/orders/:id — 未登录返回 401', async () => {
    mockAuthenticate.mockImplementation(async () => {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    })
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid' },
    })
    expect(res.statusCode).toBe(401)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('PUT /admin/orders/:id — 非 admin 返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('PUT /admin/orders/:id — 不存在返回 404', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(db.update).toHaveBeenCalled()
  })

  it('PUT /admin/orders/:id — 成功更新 status=paid 200', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([makeOrder({ status: 'paid' })])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid', payType: 'wechat', remark: '已支付' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('paid')
    expect(db.update).toHaveBeenCalled()
  })

  it('PUT /admin/orders/:id — status 枚举非法值返回 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
      payload: { status: 'invalid_status' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('PUT /admin/orders/:id — 黑名单字段 payAmount 被严格模式拒绝 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
      payload: { payAmount: '0.01' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  // ---------- DELETE /admin/orders/:id ----------

  it('DELETE /admin/orders/:id — 未登录返回 401', async () => {
    mockAuthenticate.mockImplementation(async () => {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    })
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
    })
    expect(res.statusCode).toBe(401)
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('DELETE /admin/orders/:id — 非 admin 返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
    })
    expect(res.statusCode).toBe(403)
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('DELETE /admin/orders/:id — 不存在返回 404', async () => {
    mockAdmin()
    mockDeleteReturning.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(db.delete).toHaveBeenCalled()
  })

  it('DELETE /admin/orders/:id — 成功删除返回 200', async () => {
    mockAdmin()
    mockDeleteReturning.mockResolvedValueOnce([makeOrder()])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/orders/${ORDER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(ORDER_ID)
    expect(body.data.deleted).toBe(true)
    expect(db.delete).toHaveBeenCalled()
  })

  // ---------- POST /admin/customer-service/send ----------

  it('POST /admin/customer-service/send — 未登录返回 401', async () => {
    mockAuthenticate.mockImplementation(async () => {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/customer-service/send`,
      payload: { ticketId: TICKET_ID, content: '客服回复' },
    })
    expect(res.statusCode).toBe(401)
    expect(mockCreateComment).not.toHaveBeenCalled()
  })

  it('POST /admin/customer-service/send — 非 admin 返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/customer-service/send`,
      payload: { ticketId: TICKET_ID, content: '客服回复' },
    })
    expect(res.statusCode).toBe(403)
    expect(mockCreateComment).not.toHaveBeenCalled()
  })

  it('POST /admin/customer-service/send — ticket 不存在返回 404', async () => {
    mockAdmin()
    mockFindTicketById.mockResolvedValueOnce(undefined)
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/customer-service/send`,
      payload: { ticketId: TICKET_ID, content: '客服回复' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(mockFindTicketById).toHaveBeenCalledWith(TICKET_ID)
    expect(mockCreateComment).not.toHaveBeenCalled()
  })

  it('POST /admin/customer-service/send — 成功创建评论 201', async () => {
    mockAdmin()
    mockFindTicketById.mockResolvedValueOnce(makeTicket())
    mockCreateComment.mockResolvedValueOnce({ id: COMMENT_ID })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/customer-service/send`,
      payload: { ticketId: TICKET_ID, content: '客服回复内容', attachments: [] },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.created).toBe(true)
    expect(body.data.id).toBe(COMMENT_ID)
    expect(mockFindTicketById).toHaveBeenCalledWith(TICKET_ID)
    expect(mockCreateComment).toHaveBeenCalledWith({
      ticketId: TICKET_ID,
      userId: ADMIN_USER,
      content: '客服回复内容',
      isAdmin: true,
      attachments: [],
    })
  })

  it('POST /admin/customer-service/send — ticketId 非 uuid 返回 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/customer-service/send`,
      payload: { ticketId: 'not-a-uuid', content: '回复' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockCreateComment).not.toHaveBeenCalled()
  })

  it('POST /admin/customer-service/send — content 为空返回 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/customer-service/send`,
      payload: { ticketId: TICKET_ID, content: '' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockCreateComment).not.toHaveBeenCalled()
  })
})
