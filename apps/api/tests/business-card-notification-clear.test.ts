// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 补两条"前端已在调、后端没有"的覆盖缺口:
 *   ① `GET /api/business-card/mine`  —— business-card 页小标题是"我的名片"且每卡带
 *      edit/delete/share,但原先打的 `/api/business-card`(空路径)后端**零注册**(恒 404);
 *      语义上能用的 `/api/business-card/list` 又是 isPublic=true 的**全体公开卡**(广场),
 *      拿到别人的卡 ⇒ edit/delete 必然 403/404 ⇒ 补按 request.userId 过滤的 mine。
 *   ② `DELETE /api/notifications`    —— use-notification.ts clearAll() 在调,
 *      但 notifications.ts 此前只有 `DELETE /notifications/:id`(单条)与
 *      `POST /notifications/read-all`(标记已读,**不删**),没有"物理删除全部"。
 *
 * 归属过滤是本文件的核心判据:两条都是**写/读全量集合**的端点,
 * 漏掉 `request.userId` 就是跨用户数据泄露/删除,而"返回 200 + 有 list"这类断言
 * 对它完全失明 —— 所以沿用 member-list-endpoints.test.ts 的做法:
 * **桩掉 drizzle-orm 算子并把实参录下来**,逐字断言"过滤的是不是本表自己的 userId 列、
 * 跟谁比";DELETE 侧则桩掉 notification-queries,直接断言传进去的 userId 实参。
 *
 * 测试隔离铁律(AGENTS §5):全程不连真实 PostgreSQL —— db 层整体桩掉,不触库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  mockAuthenticate,
  dbQueue,
  eqCalls,
  whereCalls,
  deleteAllArgs,
  mockDeleteAllNotifications,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
  // 录下每次 eq(左列, 右值) 的实参 —— 归属过滤的判据就钉在这里
  eqCalls: [] as { left: unknown; right: unknown }[],
  // 录下每次 db.select(...).where(X) 的 X —— 用来证明"列表条"和"count 条"
  // **两条查询都带了同一个归属条件**(where 表达式只构造一次、两条链共用)
  whereCalls: [] as unknown[],
  // deleteAllNotifications(userId) 的实参:清空类端点的归属判据
  deleteAllArgs: [] as unknown[],
  mockDeleteAllNotifications: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 算子桩:不真正执行 SQL,但把"过滤了哪一列 / 跟谁比"如实录下来。
vi.mock('drizzle-orm', () => {
  const sqlTag = Object.assign(
    vi.fn((strs: TemplateStringsArray, ...vals: unknown[]) => ({
      op: 'sql',
      text: String(strs),
      vals,
    })),
    { raw: (c: unknown) => c, join: (parts: unknown[]) => ({ op: 'sqljoin', parts }) },
  )
  return {
    eq: vi.fn((left: unknown, right: unknown) => {
      eqCalls.push({ left, right })
      return { op: 'eq', left, right }
    }),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
    not: vi.fn((...args: unknown[]) => ({ op: 'not', args })),
    desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
    asc: vi.fn((col: unknown) => ({ op: 'asc', col })),
    ilike: vi.fn((col: unknown, pat: unknown) => ({ op: 'ilike', col, pat })),
    like: vi.fn((col: unknown, pat: unknown) => ({ op: 'like', col, pat })),
    gte: vi.fn((col: unknown, v: unknown) => ({ op: 'gte', col, v })),
    lte: vi.fn((col: unknown, v: unknown) => ({ op: 'lte', col, v })),
    gt: vi.fn((col: unknown, v: unknown) => ({ op: 'gt', col, v })),
    lt: vi.fn((col: unknown, v: unknown) => ({ op: 'lt', col, v })),
    inArray: vi.fn((col: unknown, v: unknown) => ({ op: 'inArray', col, v })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    isNotNull: vi.fn((col: unknown) => ({ op: 'isNotNull', col })),
    between: vi.fn((col: unknown, a: unknown, b: unknown) => ({ op: 'between', col, a, b })),
    exists: vi.fn((q: unknown) => ({ op: 'exists', q })),
    ne: vi.fn((left: unknown, right: unknown) => ({ op: 'ne', left, right })),
    sql: sqlTag,
    count: vi.fn((col?: unknown) => ({ op: 'count', col })),
    sum: vi.fn((col: unknown) => ({ op: 'sum', col })),
    avg: vi.fn((col: unknown) => ({ op: 'avg', col })),
    distinct: vi.fn((col: unknown) => ({ op: 'distinct', col })),
    getTableColumns: vi.fn(() => ({})),
  }
})

// @ihui/database **部分**桩:other 路由 barrel 会牵进大量无关表(它们 import 期就读列),
// 整表桩掉会炸在 promotion-queries 之类的地方 ⇒ 这里只把本批要断言的表换成
// 可辨识的字符串列名,其余原样放行。
vi.mock('@ihui/database', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    businessCards: {
      id: 'business_cards.id',
      userId: 'business_cards.userId',
      name: 'business_cards.name',
      title: 'business_cards.title',
      company: 'business_cards.company',
      phone: 'business_cards.phone',
      email: 'business_cards.email',
      avatar: 'business_cards.avatar',
      intro: 'business_cards.intro',
      qrCode: 'business_cards.qrCode',
      isPublic: 'business_cards.isPublic',
      viewCount: 'business_cards.viewCount',
      createdAt: 'business_cards.createdAt',
      updatedAt: 'business_cards.updatedAt',
    },
    businessCardFavorites: {
      id: 'business_card_favorites.id',
      userId: 'business_card_favorites.userId',
      cardId: 'business_card_favorites.cardId',
      createdAt: 'business_card_favorites.createdAt',
    },
    users: {
      id: 'users.id',
      nickname: 'users.nickname',
      avatar: 'users.avatar',
    },
    // 清空通知的归属列也要能逐字断言(见 deleteAllNotifications 本体那组)
    notifications: {
      id: 'notifications.id',
      userId: 'notifications.userId',
      type: 'notifications.type',
      title: 'notifications.title',
      content: 'notifications.content',
      isRead: 'notifications.isRead',
      createdAt: 'notifications.createdAt',
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
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'innerJoin',
      'leftJoin',
      'groupBy',
    ]) {
      chain[m] = () => chain
    }
    // where 单独录实参:归属过滤判据要落在"哪条查询链带了条件"上,
    // 而不只是"eq 被调过一次"(where 表达式在生产里只构造一次、两条链共用同一个对象)
    chain.where = (cond: unknown) => {
      whereCalls.push(cond)
      return chain
    }
    chain.select = () => chain
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

// notification-queries **部分**桩:路由层测试用 deleteAllNotifications 录实参;
// 但"路由把 userId 传对了"并不等于"查询真的按 userId 过滤了" —— 后者由下面
// describe('deleteAllNotifications 本体') 直接打真函数验(那一组不桩它)。
const actualNotificationQueries = await vi.importActual<
  typeof import('../src/db/notification-queries.js')
>('../src/db/notification-queries.js')

vi.mock('../src/db/notification-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    deleteAllNotifications: vi.fn(async (userId: string) => {
      deleteAllArgs.push(userId)
      return mockDeleteAllNotifications(userId)
    }),
  }
})

import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'
import { notificationRoutes } from '../src/routes/notifications.js'

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

/**
 * 数一条 where 表达式树里"拿 business_cards.userId 去比某个值"的 eq 出现了几次。
 * 之所以要递归数而不是只看 eqCalls:生产里归属条件只**构造一次**
 * (const where = and(...)),列表链和 count 链共用同一个对象 ⇒ eqCalls 只会记到 1 次。
 * 真正要钉的是"两条查询链的 where 都含这个条件",那就要看 .where() 的实参。
 */
function countUserIdFiltersInWhere(cond: unknown): number {
  if (!cond || typeof cond !== 'object') return 0
  const node = cond as { op?: string; left?: unknown; right?: unknown; args?: unknown[] }
  if (node.op === 'eq' && node.left === 'business_cards.userId') return 1
  if (Array.isArray(node.args)) {
    return node.args.reduce<number>((sum, a) => sum + countUserIdFiltersInWhere(a), 0)
  }
  return 0
}

function cardRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: USER_ID,
    name: '李春川',
    title: '创始人',
    company: '智汇AI',
    phone: '13800000000',
    email: 'li@example.com',
    avatar: null,
    intro: '简介',
    qrCode: null,
    // 默认给 isPublic=false:私密卡也必须出现在"我的名片"里
    isPublic: false,
    viewCount: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  }
}

describe('补缺口 ① GET /api/business-card/mine —「我的名片」按 userId 归属过滤', () => {
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
    whereCalls.length = 0
    mockAuthenticate.mockReset()
  })

  it('未登录 → 401,且不查库', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/mine` })
    expect(res.statusCode).toBe(401)
    expect(eqCalls).toHaveLength(0)
  })

  it('端点存在:登录后 200,返回 {list,total,page,pageSize}(前端 d.list 契约)', async () => {
    mockAuthed()
    enqueue([cardRow()], [{ count: 1 }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/mine` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(body.data.total).toBe(1)
    expect(body.data.page).toBe(1)
    expect(typeof body.data.pageSize).toBe('number')
  })

  it('旧的 GET /api/business-card(空路径)确实不存在 ⇒ 前端必须改指 /mine', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card` })
    expect(res.statusCode).toBe(404)
  })

  it('归属过滤:where 条件命中 business_cards.userId 且值 === request.userId', async () => {
    mockAuthed(USER_ID)
    enqueue([cardRow()], [{ count: 1 }])
    await server.inject({ method: 'GET', url: `${PREFIX}/business-card/mine` })

    const onUserId = eqCalls.filter((c) => c.left === 'business_cards.userId')
    expect(onUserId.length).toBeGreaterThan(0)
    expect(onUserId.every((c) => c.right === USER_ID)).toBe(true)
    // 反向:任何一次都不许拿 userId 列去比一个不是本请求用户的值
    expect(
      eqCalls.filter((c) => c.left === 'business_cards.userId' && c.right !== USER_ID),
    ).toHaveLength(0)
    // **每条查询链**都要带归属过滤(实测踩过的坑):本端点发两条查询(列表 + count),
    // 归属条件只构造一次、两条链共用。只断言"eq 至少被调一次"会被
    // "列表那条 .where(cond) 被删、count 那条还在"蒙过去 —— 变异验证②实测会翻红。
    expect(whereCalls.length).toBeGreaterThanOrEqual(2)
    expect(whereCalls.every((c) => countUserIdFiltersInWhere(c) === 1)).toBe(true)
  })

  it('归属过滤按当前登录用户走(换用户即换比较值)', async () => {
    mockAuthed(OTHER_USER)
    enqueue([cardRow({ userId: OTHER_USER })], [{ count: 1 }])
    await server.inject({ method: 'GET', url: `${PREFIX}/business-card/mine` })
    const onUserId = eqCalls.filter((c) => c.left === 'business_cards.userId')
    expect(onUserId.length).toBeGreaterThan(0)
    expect(onUserId.every((c) => c.right === OTHER_USER)).toBe(true)
  })

  it('不能被 isPublic=true 绑成广场语义:私密卡(isPublic=false)也必须返回', async () => {
    mockAuthed()
    enqueue([cardRow({ isPublic: false })], [{ count: 1 }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/mine` })
    expect(res.statusCode).toBe(200)
    // 私有化列表的判据:生产代码不许出现 isPublic 的 eq(出现了就等于又变回公开广场)
    expect(eqCalls.filter((c) => c.left === 'business_cards.isPublic')).toHaveLength(0)
  })

  it('与既有 GET /business-card/list 语义分离:list 仍按 isPublic=true 过滤', async () => {
    mockAuthed()
    enqueue([cardRow()], [{ count: 1 }])
    await server.inject({ method: 'GET', url: `${PREFIX}/business-card/list` })
    const onIsPublic = eqCalls.filter((c) => c.left === 'business_cards.isPublic')
    expect(onIsPublic.length).toBeGreaterThan(0)
    expect(onIsPublic.every((c) => c.right === true)).toBe(true)
  })

  it('/mine 不与 GET /business-card/:id 抢路由(mine 走静态段,不是被 :id 吃掉)', async () => {
    mockAuthed()
    enqueue([cardRow()], [{ count: 1 }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/mine` })
    expect(res.statusCode).toBe(200)
    // 若被 :id 吃掉,会走"按 id 查 + viewCount+1"分支并返回裸 card(无 list)
    expect(res.json().data).toHaveProperty('list')
  })

  it('列表项带 edit/delete/share 所需的归属与展示字段', async () => {
    mockAuthed()
    enqueue([cardRow()], [{ count: 1 }])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/mine` })
    const item = res.json().data.list[0]
    expect(item).toHaveProperty('id')
    // userId 必须回传:前端 share/edit/delete 的链接与后端 403 判定都靠它对齐
    expect(item.userId).toBe(USER_ID)
    for (const k of ['name', 'title', 'company', 'phone', 'email', 'avatar', 'createdAt']) {
      expect(item).toHaveProperty(k)
    }
  })

  it('分页参数越界 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/business-card/mine?pageSize=999`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('search 只收窄不放大:带 search 时归属过滤仍在每条链上', async () => {
    mockAuthed(USER_ID)
    enqueue([cardRow()], [{ count: 1 }])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/business-card/mine?search=${encodeURIComponent('李')}`,
    })
    expect(res.statusCode).toBe(200)
    expect(whereCalls.length).toBeGreaterThanOrEqual(2)
    // search 只能**加**条件(ilike 出现在 and 的参数里),userId 条件不能被顶掉
    expect(whereCalls.every((c) => countUserIdFiltersInWhere(c) === 1)).toBe(true)
    expect(
      eqCalls.filter((c) => c.left === 'business_cards.userId' && c.right !== USER_ID),
    ).toHaveLength(0)
  })
})

describe('补缺口 ② DELETE /api/notifications — 按 userId 清空全部通知', () => {
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
    // notifications.ts 注册期用 distributedRateLimit 装饰器,测试实例补同形桩
    server.decorate('distributedRateLimit', {
      addRule: vi.fn(),
      preHandler: vi.fn(() => async () => {}),
    } as never)
    // prefix 必须与生产一致(index.ts:535 是 { prefix: '/api' })
    await server.register(notificationRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    deleteAllArgs.length = 0
    eqCalls.length = 0
    whereCalls.length = 0
    mockAuthenticate.mockReset()
    mockDeleteAllNotifications.mockReset()
    mockDeleteAllNotifications.mockResolvedValue(2)
  })

  it('未登录 → 401,且一次都不该碰库', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notifications` })
    expect(res.statusCode).toBe(401)
    expect(deleteAllArgs).toHaveLength(0)
  })

  it('端点存在:登录后 200,返回 {deletedCount}(前端只看 success,不取字段)', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notifications` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.deletedCount).toBe(2)
  })

  it('归属过滤:userId 实参 === request.userId', async () => {
    mockAuthed(USER_ID)
    await server.inject({ method: 'DELETE', url: `${PREFIX}/notifications` })
    expect(deleteAllArgs).toEqual([USER_ID])
  })

  it('归属过滤按当前登录用户走(换用户即换实参)', async () => {
    mockAuthed(OTHER_USER)
    await server.inject({ method: 'DELETE', url: `${PREFIX}/notifications` })
    expect(deleteAllArgs).toEqual([OTHER_USER])
  })

  it('空集合(本就无通知)也返 200 + 0,不报错(幂等清空)', async () => {
    mockAuthed()
    mockDeleteAllNotifications.mockResolvedValue(0)
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notifications` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.deletedCount).toBe(0)
  })

  it('与既有单条端点并存不互斥:DELETE /notifications/:id 仍只删一条', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/notifications/44444444-4444-4444-8444-444444444444`,
    })
    // 单条端点存在(命中 :id 分支,不是被新加的空路径吃掉);查无此条 → 404
    expect(res.statusCode).toBe(404)
    // 关键:绝不能因为注册了 DELETE /notifications 就把 :id 路由吞掉
    expect(deleteAllArgs).toHaveLength(0)
  })

  it('与 POST /notifications/read-all 语义分离:read-all 不删行', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'POST', url: `${PREFIX}/notifications/read-all` })
    expect(res.statusCode).toBe(200)
    // read-all 只标记已读,不该触发任何物理删除
    expect(deleteAllArgs).toHaveLength(0)
  })

  it('ai-feed 的 GET /notifications 够不到这里:它是 /api/ai-feed/notifications', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notifications` })
    expect(res.statusCode).toBe(200)
    // 反证:DELETE 打到 ai-feed 前缀下不存在该路由 ⇒ 404 ⇒ 前缀不同、二者不互相顶替
    const viaAiFeed = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/ai-feed/notifications`,
    })
    expect(viaAiFeed.statusCode).toBe(404)
  })
})

/**
 * deleteAllNotifications 本体(不打桩,直接验真函数的 WHERE)。
 *
 * 变异验证③实测踩到的坑:路由那组把 deleteAllNotifications 整个桩掉后,
 * "把 `.where(eq(notifications.userId, userId))` 整行删掉"(= 变成**全表删除**)
 * 19 条用例**全绿** —— 因为桩只录了"路由传进来的实参",看不见查询里的条件。
 * 这一组补上那条缺掉的判据。
 */
describe('deleteAllNotifications 本体 — 查询必须真的按 userId 过滤', () => {
  beforeEach(() => {
    dbQueue.items.length = 0
    eqCalls.length = 0
    whereCalls.length = 0
  })

  it('返回删除条数', async () => {
    enqueue([{ id: 'n1' }, { id: 'n2' }])
    const n = await actualNotificationQueries.deleteAllNotifications(USER_ID)
    expect(n).toBe(2)
  })

  it('WHERE 命中 notifications.userId 且值 === 传入的 userId', async () => {
    enqueue([])
    await actualNotificationQueries.deleteAllNotifications(USER_ID)
    const onUserId = eqCalls.filter((c) => c.left === 'notifications.userId')
    expect(onUserId.length).toBe(1)
    expect(onUserId[0]!.right).toBe(USER_ID)
  })

  it('确实调了 .where(...) —— 删掉整行(全表删除)必翻红', async () => {
    enqueue([])
    await actualNotificationQueries.deleteAllNotifications(USER_ID)
    expect(whereCalls.length).toBe(1)
  })

  it('换用户即换比较值(不认常量)', async () => {
    enqueue([])
    await actualNotificationQueries.deleteAllNotifications(OTHER_USER)
    const onUserId = eqCalls.filter((c) => c.left === 'notifications.userId')
    expect(onUserId.length).toBe(1)
    expect(onUserId[0]!.right).toBe(OTHER_USER)
  })

  it('只删不读:不发 select(清空是写操作)', async () => {
    enqueue([])
    await actualNotificationQueries.deleteAllNotifications(USER_ID)
    // returning 走的是 delete 链;这里只确认没有额外的读链被构造
    expect(whereCalls).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
