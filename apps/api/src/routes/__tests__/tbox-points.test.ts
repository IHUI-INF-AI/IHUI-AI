// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TBox 设备积分路由测试。
 *
 * db 以链式 thenable builder mock:
 *   - db.select() 按调用顺序消费 selectQueue 中预置结果
 *   - db.insert().returning() 消费 insertQueue
 * requireAdmin 直接放行。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// Mock:admin 鉴权直接放行
vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  requireAuth: vi.fn(async () => {}),
  requirePermission: vi.fn(() => vi.fn(async () => {})),
  requireAnyPermission: vi.fn(() => vi.fn(async () => {})),
}))

const {
  selectQueue,
  insertQueue,
  pushSelect,
  pushInsertReturning,
  resetQueues,
  insertCalls,
  selectCallCount,
} = vi.hoisted(() => {
  const selectQueue: Array<unknown[] | Error> = []
  const insertQueue: Array<unknown[]> = []
  const insertCalls: Array<{ values: unknown }> = []
  const selectCallCount = { value: 0 }
  return {
    selectQueue,
    insertQueue,
    insertCalls,
    selectCallCount,
    pushSelect: (r: unknown[] | Error) => selectQueue.push(r),
    pushInsertReturning: (r: unknown[]) => insertQueue.push(r),
    resetQueues: () => {
      selectQueue.length = 0
      insertQueue.length = 0
      insertCalls.length = 0
      selectCallCount.value = 0
    },
  }
})

vi.mock('../../db/index.js', () => {
  const makeSelectBuilder = (): Record<string, unknown> => {
    const builder: Record<string, unknown> = {
      from: () => builder,
      innerJoin: () => builder,
      leftJoin: () => builder,
      where: () => builder,
      groupBy: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      offset: () => builder,
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const queued = selectQueue.shift() ?? []
        const p = queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
        return p.then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  const makeInsertChain = () => {
    const chain: Record<string, unknown> = {
      values: (values: unknown) => {
        insertCalls.push({ values })
        return chain
      },
      returning: () => Promise.resolve(insertQueue.shift() ?? []),
      then(onFulfilled?: (v: unknown) => unknown) {
        return Promise.resolve([]).then(onFulfilled)
      },
    }
    return chain
  }

  const dbMock = {
    select: () => {
      selectCallCount.value += 1
      return makeSelectBuilder()
    },
    insert: () => makeInsertChain(),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
          then: (onFulfilled?: (v: unknown) => unknown) => Promise.resolve([]).then(onFulfilled),
        }),
        then: (onFulfilled?: (v: unknown) => unknown) => Promise.resolve([]).then(onFulfilled),
      }),
    }),
    delete: () => ({ where: () => Promise.resolve([]) }),
    execute: () => Promise.resolve([]),
    transaction: (cb: (tx: unknown) => Promise<unknown>) => Promise.resolve(cb(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { tboxPointsRoutes } from '../tbox-points.js'

// ─────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────

const DEVICE_A = 'dev-1001'
const DEVICE_B = 'dev-1002'

function makePointsBean(
  overrides: Partial<{
    id: number
    beanType: string
    beanData: string
    status: number
    createTime: Date
    createdAt: Date
    updatedAt: Date
  }> = {},
) {
  return {
    id: overrides.id ?? 1,
    beanType: overrides.beanType ?? 'points',
    beanData: overrides.beanData ?? '',
    status: overrides.status ?? 1,
    createTime: overrides.createTime ?? new Date(),
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

function pointsBean(deviceId: string, eventType: string, points: number, ageMs = 60_000) {
  const at = new Date(Date.now() - ageMs)
  return makePointsBean({
    id: Math.floor(Math.random() * 100000),
    beanData: JSON.stringify({
      deviceId,
      eventType,
      points,
      createdAt: at.toISOString(),
    }),
    createTime: at,
  })
}

function makeDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    deviceNo: 'TBOX0001',
    deviceName: '测试设备',
    deviceType: 'tbox',
    userId: null,
    status: 'online',
    signal: 80,
    battery: 90,
    latitude: null,
    longitude: null,
    firmwareVersion: '1.0.0',
    lastOnlineAt: new Date(),
    registeredAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    deviceId: DEVICE_A,
    command: 'reboot',
    status: 'sent',
    payload: null,
    sentAt: new Date(),
    ackedAt: null,
    result: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('TBox 设备积分路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((error, _request, reply) => {
      const err = error as Error & { statusCode?: number }
      const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message || '服务器错误' })
    })
    await app.register(tboxPointsRoutes, { prefix: '/tbox' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    resetQueues()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /tbox/events 积分发放', () => {
    it('task_complete 事件发放 10 分,并返回累计 total', async () => {
      pushSelect([]) // 无历史流水
      pushInsertReturning([
        makePointsBean({
          id: 1,
          beanData: JSON.stringify({
            deviceId: DEVICE_A,
            eventType: 'task_complete',
            points: 10,
            createdAt: new Date().toISOString(),
          }),
        }),
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'task_complete' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toMatchObject({
        deviceId: DEVICE_A,
        eventType: 'task_complete',
        points: 10,
        total: 10,
      })
      const values = insertCalls[0]?.values as Record<string, unknown>
      expect(values.beanType).toBe('points')
      const bean = JSON.parse(String(values.beanData)) as {
        deviceId: string
        eventType: string
        points: number
      }
      expect(bean).toMatchObject({ deviceId: DEVICE_A, eventType: 'task_complete', points: 10 })
    })

    it('login 事件发放 5 分,activity 事件发放 20 分', async () => {
      pushSelect([])
      pushInsertReturning([makePointsBean()])
      const login = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'login' },
      })
      expect(login.json().data.points).toBe(5)

      pushSelect([])
      pushInsertReturning([makePointsBean()])
      const activity = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'activity' },
      })
      expect(activity.json().data.points).toBe(20)
    })

    it('未知事件类型默认发放 1 分', async () => {
      pushSelect([])
      pushInsertReturning([makePointsBean()])
      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'unknown_event' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.points).toBe(1)
    })

    it('body 显式 points 覆盖内置规则', async () => {
      pushSelect([])
      pushInsertReturning([makePointsBean()])
      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'task_complete', points: 99 },
      })
      expect(res.json().data.points).toBe(99)
    })

    it('累计:已有 10+5 分流水时 task_complete 后 total=25', async () => {
      pushSelect([
        pointsBean(DEVICE_A, 'login', 5, 120_000),
        pointsBean(DEVICE_A, 'activity', 20, 90_000),
      ])
      pushInsertReturning([makePointsBean()])
      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'task_complete' },
      })
      expect(res.json().data).toMatchObject({ points: 10, total: 35 })
    })

    it('缺少 deviceId/eventType 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: '' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /tbox/events 幂等去重', () => {
    it('同 deviceId+eventType 30s 内重复上报不重复发分,返回 duplicate', async () => {
      // 30s 窗口内已存在同设备同事件流水(10 分)
      pushSelect([pointsBean(DEVICE_A, 'task_complete', 10, 5_000)])

      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'task_complete' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toMatchObject({
        deviceId: DEVICE_A,
        eventType: 'task_complete',
        points: 10,
        total: 10,
        duplicate: true,
      })
      expect(insertCalls).toHaveLength(0) // 未产生新插入
    })

    it('同事件但超过 30s 的旧记录不拦截,正常发分', async () => {
      // 60s 前的事件已过期,允许再次发分
      pushSelect([pointsBean(DEVICE_A, 'task_complete', 10, 60_000)])
      pushInsertReturning([makePointsBean()])

      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'task_complete' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.duplicate).toBeUndefined()
      expect(res.json().data.total).toBe(20)
      expect(insertCalls).toHaveLength(1)
    })

    it('不同设备不互相去重', async () => {
      // 设备 B 在窗口内上报过,设备 A 应正常发分
      pushSelect([pointsBean(DEVICE_B, 'task_complete', 10, 5_000)])
      pushInsertReturning([makePointsBean()])

      const res = await app.inject({
        method: 'POST',
        url: '/tbox/events',
        payload: { deviceId: DEVICE_A, eventType: 'task_complete' },
      })

      expect(res.json().data).toMatchObject({ deviceId: DEVICE_A, points: 10, total: 10 })
      expect(res.json().data.duplicate).toBeUndefined()
    })
  })

  describe('GET /tbox/points 积分查询', () => {
    it('返回累计积分 SUM + 明细列表', async () => {
      pushSelect([
        pointsBean(DEVICE_A, 'login', 5, 300_000),
        pointsBean(DEVICE_A, 'activity', 20, 200_000),
      ])

      const res = await app.inject({
        method: 'GET',
        url: `/tbox/points?deviceId=${DEVICE_A}`,
      })

      expect(res.statusCode).toBe(200)
      const { data } = res.json()
      expect(data.deviceId).toBe(DEVICE_A)
      expect(data.total).toBe(25)
      expect(data.items).toHaveLength(2)
      expect(data.items.map((i: { eventType: string }) => i.eventType).sort()).toEqual([
        'activity',
        'login',
      ])
    })

    it('无记录时 total=0 且 items 为空', async () => {
      pushSelect([])
      const res = await app.inject({
        method: 'GET',
        url: `/tbox/points?deviceId=${DEVICE_A}`,
      })
      expect(res.json().data).toMatchObject({ deviceId: DEVICE_A, total: 0, items: [] })
    })

    it('缺少 deviceId 返回 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/tbox/points' })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /tbox/devices 与 GET /tbox/commands 分页', () => {
    it('设备列表返回 items 与 total', async () => {
      pushSelect([{ count: 1 }])
      pushSelect([makeDevice()])

      const res = await app.inject({ method: 'GET', url: '/tbox/devices?page=1&pageSize=10' })

      expect(res.statusCode).toBe(200)
      const { data } = res.json()
      expect(data.total).toBe(1)
      expect(data.items).toHaveLength(1)
      expect(data.items[0].deviceNo).toBe('TBOX0001')
      expect(data.page).toBe(1)
      expect(data.pageSize).toBe(10)
    })

    it('命令列表返回 items 与 total', async () => {
      pushSelect([{ count: 1 }])
      pushSelect([makeCommand()])

      const res = await app.inject({ method: 'GET', url: '/tbox/commands?page=1&pageSize=20' })

      expect(res.statusCode).toBe(200)
      const { data } = res.json()
      expect(data.total).toBe(1)
      expect(data.items[0].command).toBe('reboot')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
