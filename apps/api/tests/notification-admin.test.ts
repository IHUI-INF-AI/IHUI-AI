import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockDbExecute } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockDbExecute: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: mockDbExecute },
}))

import notificationAdminRoutes from '../src/routes/admin/notification-admin.js'

const ADMIN_USER = '00000000-0000-0000-0000-000000000001'
const REGULAR_USER = '00000000-0000-0000-0000-000000000002'
const TARGET_UUID = '11111111-1111-1111-1111-111111111111'

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

function mockUnauthorized() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

// 递归拍平 drizzle sql 模板对象为可读文本,用于断言 SQL 内容
function sqlToText(obj: unknown): string {
  if (obj === null || obj === undefined) return ''
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number' || typeof obj === 'boolean' || typeof obj === 'bigint')
    return String(obj)
  if (Array.isArray(obj)) return obj.map(sqlToText).join('')
  if (typeof obj === 'object') {
    const o = obj as Record<string, unknown>
    if (Array.isArray(o.queryChunks)) return sqlToText(o.queryChunks)
    if (Array.isArray(o.value)) return sqlToText(o.value)
    if ('value' in o) return sqlToText(o.value)
  }
  return String(obj)
}

function firstExecuteSqlText(): string {
  return sqlToText(mockDbExecute.mock.calls[0]?.[0])
}

const PREFIX = '/api/admin'

describe('notification-admin routes — /api/admin/notifications/logs', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(notificationAdminRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockDbExecute.mockReset()
    mockDbExecute.mockResolvedValue([])
    mockAuthenticate.mockReset()
  })

  it('非 admin 用户访问返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notifications/logs` })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.code).toBe(403)
    expect(mockDbExecute).not.toHaveBeenCalled()
  })

  it('admin 用户访问返回全量(不按 user_id 过滤)', async () => {
    mockAdmin()
    const rows = [
      {
        id: '1',
        user_id: 'u-a',
        type: 'email',
        channel: 'mail',
        status: 'sent',
        created_at: new Date(),
      },
      {
        id: '2',
        user_id: 'u-b',
        type: 'sms',
        channel: 'sms',
        status: 'sent',
        created_at: new Date(),
      },
      {
        id: '3',
        user_id: 'u-c',
        type: 'push',
        channel: 'push',
        status: 'sent',
        created_at: new Date(),
      },
    ]
    mockDbExecute.mockResolvedValueOnce(rows).mockResolvedValueOnce([{ count: 3 }])

    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notifications/logs` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(3)
    expect(body.data.total).toBe(3)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)

    const sqlText = firstExecuteSqlText()
    expect(sqlText).not.toContain('"user_id" =')
    expect(sqlText).not.toContain('WHERE')
  })

  it('传 userId 时只返回该用户日志(SQL 包含 user_id 过滤)', async () => {
    mockAdmin()
    mockDbExecute
      .mockResolvedValueOnce([
        {
          id: '10',
          user_id: TARGET_UUID,
          type: 'email',
          channel: 'mail',
          status: 'sent',
          created_at: new Date(),
        },
      ])
      .mockResolvedValueOnce([{ count: 1 }])

    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/notifications/logs?userId=${TARGET_UUID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)

    const sqlText = firstExecuteSqlText()
    expect(sqlText).toContain('"user_id" =')
    expect(sqlText).toContain(TARGET_UUID)
  })

  it('分页参数边界 page=2&pageSize=10 → OFFSET 10 / LIMIT 10', async () => {
    mockAdmin()
    mockDbExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }])

    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/notifications/logs?page=2&pageSize=10`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.page).toBe(2)
    expect(body.data.pageSize).toBe(10)

    const sqlText = firstExecuteSqlText()
    expect(sqlText).toContain('LIMIT 10')
    expect(sqlText).toContain('OFFSET 10')
  })

  it('未登录访问返回 401', async () => {
    mockUnauthorized()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notifications/logs` })
    expect(res.statusCode).toBe(401)
  })
})
