// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 补三个前端已在调、后端无读端点/字段的缺口(G-815 批次):
 *   ① `GET /api/addresses`   —— member/addresses 页在调,address-routes 此前连 GET 都没有
 *   ③ `GET /api/notes`       —— mobile-rn NoteScreen 在调,notes-routes 唯独缺列表
 *   ④ `GET /api/study/plans` —— 补 StudyPlanItem 需要的 4 个字段(只增不改)
 *
 * 归属过滤是本批的核心风险:列表端点漏掉 `userId` 条件就是**跨用户数据泄露**,
 * 而"返回 200 + 有 list"这类断言对它是全绿 —— 所以这里不复用既有测试那种
 * "链式 mock 吐几行假数据"的桩法(它对 where 条件完全失明),
 * 改为**桩掉 drizzle-orm 的算子并把实参录下来**,直接断言:
 *   - 过滤列就是该表自己的 `userId` 列(不是别的同名列);
 *   - 比较值就是本次请求的 `request.userId`(不是硬编码常量、更不是 undefined)。
 * 变异验证:把生产里的 `eq(...userId, request.userId!)` 退回 `eq(...userId, OTHER_USER)`
 * 或整条删掉,本文件必翻红。
 *
 * 测试隔离铁律(AGENTS §5):全程不连真实 PostgreSQL —— db 层整体桩掉,
 * db 的 select 链返回预设行,不触库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, dbQueue, eqCalls } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
  // 录下每次 eq(左列, 右值) 的实参 —— 归属过滤的判据就钉在这里
  eqCalls: [] as { left: unknown; right: unknown }[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 算子桩:不真正执行 SQL,但把"过滤了哪一列 / 跟谁比"如实录下来。
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left: unknown, right: unknown) => {
    eqCalls.push({ left, right })
    return { op: 'eq', left, right }
  }),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  asc: vi.fn((col: unknown) => ({ op: 'asc', col })),
  sql: Object.assign(
    vi.fn((strs: TemplateStringsArray, ...vals: unknown[]) => ({
      op: 'sql',
      text: String(strs),
      vals,
    })),
    { raw: (c: unknown) => c },
  ),
  count: vi.fn(() => ({ op: 'count' })),
  sum: vi.fn(() => ({ op: 'sum' })),
}))

// @ihui/database **部分**桩:other 路由 barrel 会牵进大量无关表(它们 import 期就读列),
// 整表桩掉会炸在 promotion-queries 之类的地方 ⇒ 这里只把本批要断言的三张表换成
// 可辨识的字符串列名,其余原样放行。字符串列名的用意:让"过滤的是不是 userId 列"
// 能逐字断言,而不是"两个 Proxy 长得像"。
vi.mock('@ihui/database', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    userAddresses: {
      id: 'user_addresses.id',
      userId: 'user_addresses.userId',
      recipientName: 'user_addresses.recipientName',
      phone: 'user_addresses.phone',
      province: 'user_addresses.province',
      city: 'user_addresses.city',
      district: 'user_addresses.district',
      detail: 'user_addresses.detail',
      postalCode: 'user_addresses.postalCode',
      isDefault: 'user_addresses.isDefault',
      createdAt: 'user_addresses.createdAt',
    },
    notes: {
      id: 'notes.id',
      userId: 'notes.userId',
      title: 'notes.title',
      content: 'notes.content',
      isPublic: 'notes.isPublic',
      lessonId: 'notes.lessonId',
      createdAt: 'notes.createdAt',
      updatedAt: 'notes.updatedAt',
    },
    lessonSignUps: {
      id: 'lesson_sign_ups.id',
      userId: 'lesson_sign_ups.userId',
      lessonId: 'lesson_sign_ups.lessonId',
      progress: 'lesson_sign_ups.progress',
      status: 'lesson_sign_ups.status',
      createdAt: 'lesson_sign_ups.createdAt',
    },
    lessons: {
      id: 'lessons.id',
      title: 'lessons.title',
      lessonCount: 'lessons.lessonCount',
    },
  }
})

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'innerJoin',
      'leftJoin',
      'select',
      'groupBy',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    insert: vi.fn(factory),
    update: vi.fn(factory),
    delete: vi.fn(factory),
    transaction: vi.fn(),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'

const PREFIX = '/api'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_USER = '00000000-0000-4000-8000-0000000000ff'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

function addressRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: USER_ID,
    recipientName: '张三',
    phone: '13800000000',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    detail: '科技园路1号',
    postalCode: '518000',
    isDefault: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: '课堂笔记',
    content: '正文',
    updatedAt: new Date('2026-02-02T03:04:05Z'),
    ...overrides,
  }
}

describe('补缺口:GET /api/addresses + GET /api/notes + GET /api/study/plans 字段', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    dbQueue.items.length = 0
    eqCalls.length = 0
    mockAuthenticate.mockReset()
  })

  // =====================================================================
  // ① GET /api/addresses
  // =====================================================================

  describe('① GET /api/addresses — 列表(此前后端连 GET 都没有)', () => {
    it('未登录 → 401,且不查库', async () => {
      mockUnauthed()
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/addresses` })
      expect(res.statusCode).toBe(401)
      expect(eqCalls).toHaveLength(0)
    })

    it('端点存在:登录后 200 且返回 {list,total,page,pageSize}', async () => {
      mockAuthed()
      enqueue([addressRow()], [{ count: 1 }])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/addresses` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
      expect(body.data).toHaveProperty('page')
      expect(body.data).toHaveProperty('pageSize')
      expect(Array.isArray(body.data.list)).toBe(true)
    })

    it('归属过滤:where 条件命中 user_addresses.userId 且值 === request.userId', async () => {
      mockAuthed(USER_ID)
      enqueue([addressRow()], [{ count: 1 }])
      await server.inject({ method: 'GET', url: `${PREFIX}/addresses` })

      // 过滤列必须是本表自己的 userId 列(漏成别的同名列同样是泄露)
      const onUserId = eqCalls.filter((c) => c.left === 'user_addresses.userId')
      expect(onUserId.length).toBeGreaterThan(0)
      // 比较值必须是本次请求的登录用户,而不是常量/别人/空
      expect(onUserId.every((c) => c.right === USER_ID)).toBe(true)
      // 反向:任何一次 eq 都不许拿 userId 列去比一个不是本请求用户的值
      expect(eqCalls.filter((c) => c.left === 'user_addresses.userId' && c.right !== USER_ID))
        .toHaveLength(0)
      // **条数**也钉住(实测踩过的坑):本端点发两条查询(列表 + count),两条都要过滤。
      // 只断言"至少有一次"会被"列表那条漏了、count 那条还在"蒙过去 —— 变异验证②实测:
      // 删掉列表的 where 后本用例照样全绿,因为 count 的 eq 顶了数。
      expect(onUserId).toHaveLength(2)
    })

    it('归属过滤对每个登录用户都成立(换用户即换比较值)', async () => {
      mockAuthed(OTHER_USER)
      enqueue([addressRow({ userId: OTHER_USER })], [{ count: 1 }])
      await server.inject({ method: 'GET', url: `${PREFIX}/addresses` })
      const onUserId = eqCalls.filter((c) => c.left === 'user_addresses.userId')
      expect(onUserId.length).toBeGreaterThan(0)
      expect(onUserId.every((c) => c.right === OTHER_USER)).toBe(true)
    })

    it('字段映射:DB 的 recipientName 对外叫 name(前端 Address 契约)', async () => {
      mockAuthed()
      enqueue([addressRow()], [{ count: 1 }])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/addresses` })
      const item = res.json().data.list[0]
      expect(item.name).toBe('张三')
      expect(item.phone).toBe('13800000000')
      expect(item).not.toHaveProperty('recipientName')
    })

    it('分页参数越界 → 400', async () => {
      mockAuthed()
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/addresses?pageSize=999` })
      expect(res.statusCode).toBe(400)
    })
  })

  // =====================================================================
  // ③ GET /api/notes
  // =====================================================================

  describe('③ GET /api/notes — 列表(RN NoteScreen 在调,此前没有)', () => {
    it('未登录 → 401,且不查库', async () => {
      mockUnauthed()
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes` })
      expect(res.statusCode).toBe(401)
      expect(eqCalls).toHaveLength(0)
    })

    it('端点存在:登录后 200,响应是裸数组(RN 直接 res.data.map)', async () => {
      mockAuthed()
      enqueue([noteRow()])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      // RN: fetchApi<NoteItem[]>('/api/notes') 后直接 (res.data ?? []).map(mapNote)
      // ⇒ 包成 {list} 就等于前端拿到 undefined,必须是裸数组
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0]).toMatchObject({ id: '22222222-2222-4222-8222-222222222222', title: '课堂笔记' })
    })

    it('归属过滤:where 条件命中 notes.userId 且值 === request.userId', async () => {
      mockAuthed(USER_ID)
      enqueue([noteRow()])
      await server.inject({ method: 'GET', url: `${PREFIX}/notes` })
      const onUserId = eqCalls.filter((c) => c.left === 'notes.userId')
      expect(onUserId.length).toBeGreaterThan(0)
      expect(onUserId.every((c) => c.right === USER_ID)).toBe(true)
      expect(eqCalls.filter((c) => c.left === 'notes.userId' && c.right !== USER_ID)).toHaveLength(0)
    })

    it('归属过滤按当前登录用户走(换用户即换比较值)', async () => {
      mockAuthed(OTHER_USER)
      enqueue([noteRow()])
      await server.inject({ method: 'GET', url: `${PREFIX}/notes` })
      const onUserId = eqCalls.filter((c) => c.left === 'notes.userId')
      expect(onUserId.length).toBeGreaterThan(0)
      expect(onUserId.every((c) => c.right === OTHER_USER)).toBe(true)
    })

    it('updatedAt 是 ISO 字符串(RN 用 formatDateByTemplate 吃字符串)', async () => {
      mockAuthed()
      enqueue([noteRow()])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes` })
      const item = res.json().data[0]
      expect(typeof item.updatedAt).toBe('string')
      expect(new Date(item.updatedAt).toISOString()).toBe(item.updatedAt)
    })

    it('与既有 GET /notes/public 形状不冲突(public 仍是 50 条公开列表)', async () => {
      mockAuthed()
      enqueue([{ id: 'n1', title: 't', content: 'c'.repeat(200), author: 'a', createdAt: new Date() }])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/public` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data[0].summary).toHaveLength(100)
    })
  })

  // =====================================================================
  // ④ GET /api/study/plans 的 4 个字段
  // =====================================================================

  describe('④ GET /api/study/plans — 补 StudyPlanItem 需要的 4 个字段(只增不改)', () => {
    function signup(overrides: Record<string, unknown> = {}) {
      return {
        id: '33333333-3333-4333-8333-333333333333',
        progress: 50,
        createdAt: new Date('2026-03-01T00:00:00Z'),
        lessonTitle: '函数式编程入门',
        lessonCount: 10,
        ...overrides,
      }
    }

    it('4 个新字段都在,且类型正确', async () => {
      mockAuthed()
      enqueue([signup()])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
      expect(res.statusCode).toBe(200)
      const plan = res.json().data[0]
      expect(plan.totalLessons).toBe(10)
      expect(plan.completedLessons).toBe(5)
      expect(plan.progress).toBe(50)
      expect(typeof plan.deadline).toBe('string')
    })

    it('已有字段一个都没改名/删掉(前端已按现名写映射)', async () => {
      mockAuthed()
      enqueue([signup()])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
      const plan = res.json().data[0]
      for (const k of ['id', 'title', 'courseName', 'targetMinutes', 'completedMinutes', 'dueDate', 'status']) {
        expect(plan).toHaveProperty(k)
      }
      expect(plan.targetMinutes).toBe(300)
      expect(plan.completedMinutes).toBe(150)
    })

    it('deadline 与既有 dueDate 同源(都是 createdAt + 30 天)', async () => {
      mockAuthed()
      enqueue([signup()])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
      const plan = res.json().data[0]
      expect(plan.deadline).toBe(plan.dueDate)
      expect(plan.deadline).toBe('2026-03-31')
    })

    it('status 值域未被改动(仍是 pending/inProgress/completed 三档)', async () => {
      mockAuthed()
      enqueue([signup({ progress: 0 })], [signup({ progress: 50 })], [signup({ progress: 100 })])
      const pick = async () => {
        const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        return res.json().data[0].status
      }
      expect(await pick()).toBe('pending')
      expect(await pick()).toBe('inProgress')
      expect(await pick()).toBe('completed')
    })

    it('progress=0 时 completedLessons 为 0,不出现负数或 NaN', async () => {
      mockAuthed()
      enqueue([signup({ progress: 0 })])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
      const plan = res.json().data[0]
      expect(plan.completedLessons).toBe(0)
      expect(Number.isNaN(plan.completedLessons)).toBe(false)
    })

    it('归属过滤:计划列表仍按 lesson_sign_ups.userId 过滤', async () => {
      mockAuthed(USER_ID)
      enqueue([signup()])
      await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
      const onUserId = eqCalls.filter((c) => c.left === 'lesson_sign_ups.userId')
      expect(onUserId.length).toBeGreaterThan(0)
      expect(onUserId.every((c) => c.right === USER_ID)).toBe(true)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
