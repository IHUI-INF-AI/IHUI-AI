// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { getTableName } from 'drizzle-orm'

const USER_ID = '00000000-0000-4000-8000-0000000000aa'

const { dbState, dbCalls, authenticateMock, sendPushBatchMock } = vi.hoisted(() => ({
  dbState: {
    selectRows: [] as unknown[][],
    updateReturning: [] as unknown[],
    executeResult: [] as unknown[],
  },
  dbCalls: {
    insertTables: [] as unknown[],
    updateTables: [] as unknown[],
    selectTables: [] as unknown[],
    insertValues: [] as unknown[],
    updateSets: [] as unknown[],
    executeCount: 0,
  },
  authenticateMock: vi.fn(),
  sendPushBatchMock: vi.fn(),
}))

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: (table?: unknown) => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: (value: unknown) => DbChain
    set: (value: unknown) => DbChain
    returning: () => DbChain
    onConflictDoUpdate: () => DbChain
    onConflictDoNothing: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: (table) => {
        if (table) dbCalls.selectTables.push(table)
        return chain
      },
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: (value) => {
        dbCalls.insertValues.push(value)
        return chain
      },
      set: (value) => {
        dbCalls.updateSets.push(value)
        return chain
      },
      returning: () => chain,
      onConflictDoUpdate: () => chain,
      onConflictDoNothing: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn(async () => {
        dbCalls.executeCount += 1
        return dbState.executeResult
      }),
      select: vi.fn(() => createChain(dbState.selectRows.shift() ?? [])),
      insert: vi.fn((table: unknown) => {
        dbCalls.insertTables.push(table)
        return createChain()
      }),
      update: vi.fn((table: unknown) => {
        dbCalls.updateTables.push(table)
        return createChain(dbState.updateReturning)
      }),
    },
  }
})

vi.mock('../../plugins/auth.js', () => ({
  authenticate: authenticateMock,
  checkAuth: vi.fn(async () => true),
}))
vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => true),
}))
vi.mock('../../services/push-provider.js', () => ({
  sendPushBatch: sendPushBatchMock,
  detectPushProvider: vi.fn(() => 'stub'),
}))

import { pushRoutes, adminPushRoutes } from '../push.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('推送设备注册(F-680)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(pushRoutes, { prefix: '/api' })
    await app.register(adminPushRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  beforeEach(() => {
    dbState.selectRows.length = 0
    dbState.updateReturning = []
    dbCalls.insertTables.length = 0
    dbCalls.updateTables.length = 0
    dbCalls.selectTables.length = 0
    dbCalls.insertValues.length = 0
    dbCalls.updateSets.length = 0
    dbCalls.executeCount = 0
    authenticateMock.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
    sendPushBatchMock.mockReset()
    sendPushBatchMock.mockResolvedValue([{ success: true, token: 'tok-1' }])
  })

  it('register 以 UUID userId 写入 device_tokens(旧写法写 edu_notification_device.member_id)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/devices/register',
      headers: AUTH_HEADERS,
      body: { deviceToken: 'tok-1', deviceType: 'ios' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.registered).toBe(true)
    expect(dbCalls.executeCount).toBe(0)
    expect(dbCalls.insertTables).toHaveLength(1)
    expect(getTableName(dbCalls.insertTables[0] as never)).toBe('device_tokens')

    const values = dbCalls.insertValues[0] as Record<string, unknown>
    expect(values.userId).toBe(USER_ID)
    expect(values.token).toBe('tok-1')
    expect(values.platform).toBe('ios')
    expect(values.deviceType).toBe('ios')
    expect(values.isActive).toBe(true)
  })

  it('unregister 以 (deviceToken, userId) 命中并置 isActive=false', async () => {
    dbState.updateReturning = [{ id: 'device-1' }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/devices/unregister',
      headers: AUTH_HEADERS,
      body: { deviceToken: 'tok-1' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.unregistered).toBe(true)
    expect(res.json().data.removed).toBe(1)
    expect(dbCalls.executeCount).toBe(0)
    expect(dbCalls.updateTables).toHaveLength(1)
    expect(getTableName(dbCalls.updateTables[0] as never)).toBe('device_tokens')
    expect(dbCalls.updateSets[0]).toMatchObject({ isActive: false })
  })

  it('unregister 未命中(不含他人 token)⇒ 404,不静默成功', async () => {
    dbState.updateReturning = []
    const res = await app.inject({
      method: 'POST',
      url: '/api/push/devices/unregister',
      headers: AUTH_HEADERS,
      body: { deviceToken: 'someone-elses-token' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('admin 按 memberIds(user uuid)查设备走 device_tokens(旧写法按 int[] 查教育表)', async () => {
    dbState.selectRows.push([{ token: 'tok-1' }])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', memberIds: [USER_ID] },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.total).toBe(1)
    expect(dbCalls.executeCount).toBe(0)
    expect(dbCalls.selectTables).toHaveLength(1)
    expect(getTableName(dbCalls.selectTables[0] as never)).toBe('device_tokens')
    expect(sendPushBatchMock).toHaveBeenCalledWith(
      [{ token: 'tok-1' }],
      expect.objectContaining({ title: 't', body: 'b' }),
    )
  })
})
