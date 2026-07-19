/**
 * AdminContent 统一 CRUD 单元测试。
 *
 * 覆盖：
 *  - 401 无 admin
 *  - 400 无效 type
 *  - 列表/创建/更新/删除 advertise(carousels)
 *  - 列表 announcement
 *  - 400 创建缺必填(title/content)
 *  - 404 更新/删除不存在的 id
 *  - 200 删除成功
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// Mock require-permission:不设 roleId 时抛 401,设 roleId >= 1 时放行
vi.mock('../../../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { roleId?: number }) => {
    if (!request.roleId || request.roleId < 1) {
      const err = new Error('admin required') as Error & { statusCode?: number }
      err.statusCode = 401
      throw err
    }
  },
}))

const queues: { type: string; method: 'select' | 'insert' | 'update' | 'delete'; result: unknown }[] =
  []
let cursor = 0

const { dbMock } = vi.hoisted(() => {
  function makeChain<T>(result: T): DbChain<T> {
    const chain = {} as DbChain<T>
    chain.then = (resolve) => Promise.resolve(result).then(resolve)
    chain.from = () => chain
    chain.where = () => chain
    chain.orderBy = () => chain
    chain.limit = () => chain
    chain.offset = () => chain
    chain.values = () => chain
    chain.set = () => chain
    chain.returning = () => chain
    return chain
  }
  return {
    dbMock: {
      select: vi.fn(() => {
        const q = queues[cursor++]
        return makeChain(q?.result ?? [])
      }),
      insert: vi.fn(() => makeChain(queues[cursor++]?.result ?? [])),
      update: vi.fn(() => makeChain(queues[cursor++]?.result ?? [])),
      delete: vi.fn(() => makeChain(queues[cursor++]?.result ?? [])),
    },
  }
})

vi.mock('../../../src/db/index.js', () => ({ db: dbMock }))

import { adminContentCrudRoutes } from '../../../src/routes/admin/content/crud.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('roleId', undefined)
  app.addHook('preHandler', async (request) => {
    const header = request.headers['x-test-role']
    if (typeof header === 'string' && header) {
      ;(request as { roleId?: number }).roleId = Number.parseInt(header, 10)
    }
  })
  await app.register(adminContentCrudRoutes, { prefix: '/api/admin/content' })
  await app.ready()
  return app
}

describe('AdminContent CRUD', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    queues.length = 0
    cursor = 0
    dbMock.select.mockClear()
    dbMock.insert.mockClear()
    dbMock.update.mockClear()
    dbMock.delete.mockClear()
  })

  it('401 without admin role', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/content/announcement' })
    expect(res.statusCode).toBe(401)
  })

  it('400 on invalid type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/content/not-a-type',
      headers: { 'x-test-role': '1' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /announcement list returns page data', async () => {
    queues.push({ type: 'ann', method: 'select', result: [{ id: 'a1', title: 't1' }] })
    queues.push({ type: 'ann', method: 'select', result: [{ c: 1 }] })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/content/announcement',
      headers: { 'x-test-role': '1' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([{ id: 'a1', title: 't1' }])
  })

  it('POST /advertise creates a row', async () => {
    queues.push({ type: 'carousel', method: 'insert', result: [{ id: 'c1', title: 'ad1' }] })
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/content/advertise',
      headers: { 'x-test-role': '1' },
      payload: { position: 'home', imageUrl: 'https://x/y.png' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.data.item.id).toBe('c1')
  })

  it('POST /advertise 400 when missing required', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/content/advertise',
      headers: { 'x-test-role': '1' },
      payload: { title: 'no position' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /announcement 400 when missing title', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/content/announcement',
      headers: { 'x-test-role': '1' },
      payload: { content: 'no title' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /announcement/:id updates', async () => {
    queues.push({
      type: 'ann',
      method: 'update',
      result: [{ id: 'a1', title: 'updated' }],
    })
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/content/announcement/a1',
      headers: { 'x-test-role': '1' },
      payload: { title: 'updated' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.item.title).toBe('updated')
  })

  it('PATCH /advertise/:id 404 when not found', async () => {
    queues.push({ type: 'carousel', method: 'update', result: [] })
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/content/advertise/none',
      headers: { 'x-test-role': '1' },
      payload: { title: 'x' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /announcement/:id 200 when found', async () => {
    queues.push({ type: 'ann', method: 'delete', result: [{ id: 'a1' }] })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/content/announcement/a1',
      headers: { 'x-test-role': '1' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.deleted).toBe(true)
  })

  it('DELETE /advertise/:id 404 when not found', async () => {
    queues.push({ type: 'carousel', method: 'delete', result: [] })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/content/advertise/none',
      headers: { 'x-test-role': '1' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /advertise/:id 404 when not found', async () => {
    queues.push({ type: 'carousel', method: 'select', result: [] })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/content/advertise/none',
      headers: { 'x-test-role': '1' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /advertise/:id 200 when found', async () => {
    queues.push({ type: 'carousel', method: 'select', result: [{ id: 'c1', title: 'ad' }] })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/content/advertise/c1',
      headers: { 'x-test-role': '1' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.item.id).toBe('c1')
  })
})
