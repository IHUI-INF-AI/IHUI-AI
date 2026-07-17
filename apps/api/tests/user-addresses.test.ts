import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockResult, mockTxUpdate, mockTransaction } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockResult: vi.fn().mockResolvedValue([]),
  mockTxUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => mockResult().then(resolve)
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

function txChainable() {
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve([])
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
    update: vi.fn(() => createChainableMock()),
    insert: vi.fn(() => createChainableMock()),
    delete: vi.fn(() => createChainableMock()),
    transaction: mockTransaction,
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {
    select: vi.fn(() => createChainableMock()),
  },
  dbClient: {},
}))

import { frontendStubOtherRoutes } from '../src/routes/frontend-stub-other-routes.js'
import { db } from '../src/db/index.js'

const PREFIX = '/api'
const USER_ID = '00000000-0000-0000-0000-000000000010'
const ADDRESS_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_USER = '00000000-0000-0000-0000-000000000099'

function mockAuthed() {
  mockAuthenticate.mockImplementation(async (request: { userId?: string; jwtPayload?: unknown }) => {
    request.userId = USER_ID
    request.jwtPayload = { userId: USER_ID }
  })
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

const VALID_PAYLOAD = {
  recipientName: '张三',
  phone: '13800000000',
  province: '广东省',
  city: '深圳市',
  district: '南山区',
  detail: '科技园路1号',
  postalCode: '518000',
  isDefault: true,
}

function ownAddress(overrides: Record<string, unknown> = {}) {
  return {
    id: ADDRESS_ID,
    userId: USER_ID,
    recipientName: '张三',
    phone: '13800000000',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    detail: '科技园路1号',
    postalCode: '518000',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('user-addresses routes — /api/addresses/*', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.mockReset()
    mockResult.mockResolvedValue([])
    mockAuthenticate.mockReset()
    mockTransaction.mockReset()
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      await cb({ update: mockTxUpdate })
    })
    mockTxUpdate.mockReset()
    mockTxUpdate.mockReturnValue(txChainable())
  })

  it('未登录 POST /addresses 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/addresses`,
      payload: VALID_PAYLOAD,
    })
    expect(res.statusCode).toBe(401)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('POST /addresses (isDefault=true) 创建成功 201 且先取消其他默认', async () => {
    mockAuthed()
    mockResult
      .mockResolvedValueOnce([]) // 取消其他默认的 update
      .mockResolvedValueOnce([ownAddress({ isDefault: true })]) // insert returning
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/addresses`,
      payload: VALID_PAYLOAD,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.item.id).toBe(ADDRESS_ID)
    expect(db.update).toHaveBeenCalled() // 取消其他默认
    expect(db.insert).toHaveBeenCalled()
  })

  it('POST /addresses (无 isDefault) 创建成功 201 且不触发取消默认', async () => {
    mockAuthed()
    mockResult.mockResolvedValueOnce([ownAddress()]) // insert returning
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/addresses`,
      payload: { ...VALID_PAYLOAD, isDefault: false },
    })
    expect(res.statusCode).toBe(201)
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
  })

  it('PUT /addresses/:id 更新成功 200', async () => {
    mockAuthed()
    mockResult
      .mockResolvedValueOnce([ownAddress()]) // select existing
      .mockResolvedValueOnce([ownAddress({ detail: '科技园路2号' })]) // update returning
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/addresses/${ADDRESS_ID}`,
      payload: { detail: '科技园路2号' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.item.detail).toBe('科技园路2号')
    expect(db.update).toHaveBeenCalled()
  })

  it('PUT /addresses/:id 非所有者返回 403', async () => {
    mockAuthed()
    mockResult.mockResolvedValueOnce([ownAddress({ userId: OTHER_USER })]) // select existing
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/addresses/${ADDRESS_ID}`,
      payload: { detail: '改地址' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('PUT /addresses/:id 不存在返回 404', async () => {
    mockAuthed()
    mockResult.mockResolvedValueOnce([]) // select existing -> 空
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/addresses/${ADDRESS_ID}`,
      payload: { detail: '改地址' },
    })
    expect(res.statusCode).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('POST /addresses/:id/default 设为默认 200 且事务内取消其他默认', async () => {
    mockAuthed()
    mockResult.mockResolvedValueOnce([ownAddress()]) // select existing
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/addresses/${ADDRESS_ID}/default`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    // 事务内 2 次 tx.update:取消其他默认 + 设当前为默认
    expect(mockTxUpdate).toHaveBeenCalledTimes(2)
  })

  it('POST /addresses/:id/default 不存在返回 404', async () => {
    mockAuthed()
    mockResult.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/addresses/${ADDRESS_ID}/default`,
    })
    expect(res.statusCode).toBe(404)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('DELETE /addresses/:id 删除成功 200', async () => {
    mockAuthed()
    mockResult.mockResolvedValueOnce([ownAddress()]) // select existing
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/addresses/${ADDRESS_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(db.delete).toHaveBeenCalled()
  })

  it('DELETE /addresses/:id 不存在返回 404', async () => {
    mockAuthed()
    mockResult.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/addresses/${ADDRESS_ID}`,
    })
    expect(res.statusCode).toBe(404)
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('POST /addresses 参数校验失败返回 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/addresses`,
      payload: { recipientName: '' }, // 缺必填字段
    })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })
})
