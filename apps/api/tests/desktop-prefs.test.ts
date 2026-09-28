// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 桌面端偏好跨设备漫游的两条不变量(2026-09-28 立)。
 *
 * ① 认证 ≠ 授权:令牌主体必须是**唯一**能决定"读哪行/写哪行"的东西。
 *    判据只看最终发出去的那条 SQL —— 替身摆在 `db` 那一层,并断言
 *    "别人那个 id 从没出现在任何一条查询里";只断言状态码会放过
 *    "先改了再抛 403"与"授权判定发生在查询之后"两种写法(AGENTS §5 同条)。
 * ② 回报的是库侧确认行,不是请求侧常量:`.returning()` 回空 ⇒ 不谎报写成功;
 *    校验失败 ⇒ 一条写都没发出。
 *
 * 全程 mock,不连生产 PostgreSQL(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'
import { signAccessToken } from '@ihui/auth'

type StoredRow = {
  id: string
  userId: string
  enabled: boolean
  prefs: unknown
  updatedAt: Date
}

const capture = vi.hoisted(() => ({
  /** 每次 select 的 where 实参 = 那条查询的归属条件 */
  selectWhereArgs: [] as unknown[],
  /** 每次 insert 的 values 实参 = 那条写要落的行 */
  insertValues: [] as Array<Record<string, unknown>>,
  /** 每次 upsert 的冲突键列名(证明它是"以 user 为键"的幂等写) */
  conflictTargets: [] as string[],
  /** 库里那一行的替身:userId -> row */
  store: new Map<string, unknown>(),
}))

vi.mock('../src/db/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const colName = (c: unknown): string => (c as { name?: string }).name ?? String(c)
  /**
   * 替身约定:冲突列名 → `values()` 里那个键。
   *
   * `values()` 用 JS 字段名(`userId`),冲突键用列名(`user_id`)—— 两者是同一条事实
   * (schema 里 `userId: uuid('user_id')`)的两种写法。这里不写死 'userId' 当键,而是
   * 只有当冲突列真是 user_id 时才解析得出来:路由换成别的列做冲突键时这一格解析不到 ⇒
   * `returning()` 回空 ⇒ 路由按"未确认落库"抛错 ⇒ 用例红。替身因此是有牙的,不会替
   * 错误的写法兜住结论。
   */
  const COL_TO_PAYLOAD_KEY: Record<string, string> = { user_id: 'userId' }
  /** 把 select/returning 的字段映射({enabled: <column>})投影成纯对象 */
  const project = (row: object, fields: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(fields ?? {}).map(([key, col]) => [
        key,
        (row as Record<string, unknown>)[colName(col)],
      ]),
    )

  const fakeDb = {
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: (cond: unknown) => {
          capture.selectWhereArgs.push(cond)
          const sql = new PgDialect().sqlToQuery(cond as never).sql
          const params = new PgDialect().sqlToQuery(cond as never).params as unknown[]
          // user_id 的等值条件 ⇒ 只回那一个人的行(等价于真库的 where)
          const owner = /"user_id" =/.test(sql) ? params[params.length - 1] : undefined
          const row = typeof owner === 'string' ? capture.store.get(owner) : undefined
          return Promise.resolve(row ? [project(row, fields)] : [])
        },
      }),
    }),
    insert: () => ({
      values: (payload: Record<string, unknown>) => {
        capture.insertValues.push(payload)
        return {
          onConflictDoUpdate: (cfg: { target: unknown; set: Record<string, unknown> }) => {
            capture.conflictTargets.push(colName(cfg.target))
            return {
              returning: (retFields: Record<string, unknown>) => {
                const key = payload[COL_TO_PAYLOAD_KEY[colName(cfg.target)] ?? '']
                if (typeof key !== 'string') return Promise.resolve([])
                const prev = capture.store.get(key) as StoredRow | undefined
                const next: StoredRow = {
                  id: prev?.id ?? `row-${key}`,
                  userId: key,
                  enabled: cfg.set.enabled as boolean,
                  prefs: cfg.set.prefs,
                  updatedAt: (cfg.set.updatedAt as Date) ?? new Date(),
                }
                capture.store.set(key, next)
                return Promise.resolve([project(next, retFields ?? {})])
              },
            }
          },
        }
      },
    }),
  }

  return { ...actual, db: fakeDb }
})

// authenticate 验签后查一次用户状态(P2-14),只换掉那一次 DB 查询
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

import { desktopPrefsRoutes } from '../src/routes/desktop-prefs'
import authPlugin from '../src/plugins/auth'

const USER_A = 'aaaaaaaa-1111-4222-8333-444444444444'
const USER_B = 'bbbbbbbb-1111-4222-8333-444444444444'

const PREFS_A = {
  showTrayIcon: true,
  closeBehavior: 'ask',
  launchMinimized: false,
  traySingleClick: 'menu',
  unreadBadge: true,
  trayMenuItems: ['open', 'preferences'],
}

const tokens: Record<string, string> = {}
function headerFor(userId: string): Record<string, string> {
  const t = tokens[userId]
  if (!t) throw new Error(`token 未签发: ${userId}`)
  return { authorization: `Bearer ${t}`, 'content-type': 'application/json' }
}

/** 把捕获到的 where 渲染成真 SQL + 参数(比扒 drizzle 内部 queryChunks 稳)。 */
function renderedWhere(index: number): { sql: string; params: unknown[] } {
  const arg = capture.selectWhereArgs[index]
  if (arg === undefined) throw new Error(`第 ${index} 条 select 没发出`)
  const q = new PgDialect().sqlToQuery(arg as never)
  return { sql: q.sql, params: q.params as unknown[] }
}

let app: FastifyInstance

beforeAll(async () => {
  for (const userId of [USER_A, USER_B]) {
    tokens[userId] = await signAccessToken({
      userId,
      phone: '',
      familyId: `f-desktop-prefs-${userId.slice(0, 8)}`,
      roleId: 0,
    })
  }
  app = Fastify({ logger: false })
  await app.register(authPlugin)
  // 与 routes/index.ts 的挂载方式同形(prefix /api + 路径 /desktop/prefs)
  await app.register(desktopPrefsRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  capture.selectWhereArgs.length = 0
  capture.insertValues.length = 0
  capture.conflictTargets.length = 0
  capture.store.clear()
})

describe('① 读取:归属条件在被发出的那条 SQL 上', () => {
  it('A 自己的行读得到,且那条 select 带 user_id 等值条件', async () => {
    capture.store.set(USER_A, {
      id: 'row-a',
      userId: USER_A,
      enabled: true,
      prefs: PREFS_A,
      updatedAt: new Date(),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ enabled: true, prefs: PREFS_A })

    expect(capture.selectWhereArgs).toHaveLength(1)
    const { sql, params } = renderedWhere(0)
    expect(sql).toContain('"user_id" =')
    expect(params).toEqual([USER_A])
  })

  it('B 读不到 A 的行:200 但载荷是非权威的 { enabled:false, prefs:null }', async () => {
    capture.store.set(USER_A, {
      id: 'row-a',
      userId: USER_A,
      enabled: true,
      prefs: PREFS_A,
      updatedAt: new Date(),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_B),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ enabled: false, prefs: null })

    const { params } = renderedWhere(0)
    // A 那个 id 从未进入被发出的查询
    expect(params).not.toContain(USER_A)
    expect(capture.store.get(USER_A)).not.toBeUndefined()
  })

  it('库里没有行 ⇒ enabled:false 且 prefs:null(不是 404,也不是凭空造一份)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ enabled: false, prefs: null })
  })

  it('库里的载荷已不合法 ⇒ 不冒充权威值,prefs 回 null', async () => {
    capture.store.set(USER_A, {
      id: 'row-a',
      userId: USER_A,
      enabled: true,
      prefs: { showTrayIcon: 'yes' },
      updatedAt: new Date(),
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
    })
    expect(res.json().data).toEqual({ enabled: true, prefs: null })
  })

  it('匿名 ⇒ 401,且一条查询都没发出', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/desktop/prefs' })
    expect(res.statusCode).toBe(401)
    expect(capture.selectWhereArgs).toHaveLength(0)
  })
})

describe('② 写入:以 user 为键的幂等 upsert,且校验不过就一条写都不发', () => {
  it('A PUT 后 GET 回同一份 prefs,写入行的 userId 是令牌主体', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: true, prefs: PREFS_A },
    })
    expect(put.statusCode).toBe(200)
    expect(put.json().data).toEqual({ enabled: true, prefs: PREFS_A })
    expect(capture.insertValues).toHaveLength(1)
    expect(capture.insertValues[0]).toMatchObject({ userId: USER_A, enabled: true })
    expect(capture.conflictTargets).toEqual(['user_id'])

    const get = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
    })
    expect(get.json().data).toEqual({ enabled: true, prefs: PREFS_A })
  })

  it('重复 PUT 同一个人:仍只落一行,且第二次的写照样带着自己的 userId', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: true, prefs: PREFS_A },
    })
    await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: true, prefs: { ...PREFS_A, closeBehavior: 'quit' } },
    })
    expect(capture.store.size).toBe(1)
    expect(capture.insertValues.map((v) => v.userId)).toEqual([USER_A, USER_A])
    const row = capture.store.get(USER_A) as { prefs: typeof PREFS_A }
    expect(row.prefs.closeBehavior).toBe('quit')
  })

  it('B PUT 只动 B 那一行:A 的行逐字未变,且 B 的任何查询里都没有 A 的 id', async () => {
    const putA = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: true, prefs: PREFS_A },
    })
    expect(putA.statusCode).toBe(200)
    const rowABefore = JSON.stringify(capture.store.get(USER_A))

    capture.insertValues.length = 0
    capture.selectWhereArgs.length = 0

    const putB = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_B),
      payload: { enabled: true, prefs: { ...PREFS_A, unreadBadge: false } },
    })
    expect(putB.statusCode).toBe(200)
    expect(JSON.stringify(capture.store.get(USER_A))).toBe(rowABefore)

    const getB = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_B),
    })
    expect(getB.json().data).toEqual({ enabled: true, prefs: { ...PREFS_A, unreadBadge: false } })

    for (const v of capture.insertValues) expect(v.userId).toBe(USER_B)
    for (const i of capture.selectWhereArgs.keys()) {
      expect(renderedWhere(i).params).not.toContain(USER_A)
    }
    // B 那一侧读到的是自己的、不是 A 的那份
    expect((getB.json().data as { prefs: typeof PREFS_A }).prefs.unreadBadge).toBe(false)
  })

  it('body 里自报 userId 不改归属:被写的行仍是令牌主体那一行', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      // 多塞一个别人的 id 进去(信封 schema 会把它剥掉,不该进 SQL)
      payload: { enabled: true, prefs: PREFS_A, userId: USER_B },
    })
    expect(res.statusCode).toBe(200)
    expect(capture.insertValues[0]).not.toHaveProperty('userId', USER_B)
    expect(capture.insertValues[0]!.userId).toBe(USER_A)
    expect(capture.store.has(USER_B)).toBe(false)
    expect(capture.selectWhereArgs).toHaveLength(0)
  })

  it('enabled:true 而 prefs 缺失 ⇒ 400 且没有发出任何写', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: true },
    })
    expect(res.statusCode).toBe(400)
    // 回包信封与全站一致:{ code, message },code 与状态码同值
    expect(res.json()).toMatchObject({ code: 400 })
    expect(typeof res.json().message).toBe('string')
    expect(capture.insertValues).toHaveLength(0)
    expect(capture.store.size).toBe(0)
  })

  it('prefs 档位非法 / 含未知字段 ⇒ 400 且没有发出任何写', async () => {
    for (const bad of [
      { ...PREFS_A, closeBehavior: 'minimize' },
      { ...PREFS_A, traySingleClick: 'double' },
      { ...PREFS_A, showTrayIcon: 'true' },
      { ...PREFS_A, trayMenuItems: 'open' },
      { ...PREFS_A, somethingElse: 1 },
    ]) {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/desktop/prefs',
        headers: headerFor(USER_A),
        payload: { enabled: true, prefs: bad },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ code: 400 })
    }
    expect(capture.insertValues).toHaveLength(0)
  })

  it('enabled 不是布尔 ⇒ 400 且没有发出任何写', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: 'true', prefs: PREFS_A },
    })
    expect(res.statusCode).toBe(400)
    expect(capture.insertValues).toHaveLength(0)
  })

  it('enabled:false ⇒ 关掉漫游并把 prefs 清成 null(回的是库侧确认行)', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: true, prefs: PREFS_A },
    })
    capture.insertValues.length = 0

    const off = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: false },
    })
    expect(off.statusCode).toBe(200)
    expect(off.json().data).toEqual({ enabled: false, prefs: null })
    expect(capture.insertValues[0]).toMatchObject({ userId: USER_A, enabled: false, prefs: null })

    const get = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
    })
    expect(get.json().data).toEqual({ enabled: false, prefs: null })
  })

  it('B 关掉漫游不会碰到 A 那份还开着的配置', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
      payload: { enabled: true, prefs: PREFS_A },
    })
    const offB = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_B),
      payload: { enabled: false },
    })
    expect(offB.statusCode).toBe(200)

    const getA = await app.inject({
      method: 'GET',
      url: '/api/desktop/prefs',
      headers: headerFor(USER_A),
    })
    expect(getA.json().data).toEqual({ enabled: true, prefs: PREFS_A })
  })

  it('匿名 PUT ⇒ 401,且一条写都没发出', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/desktop/prefs',
      payload: { enabled: true, prefs: PREFS_A },
    })
    expect(res.statusCode).toBe(401)
    expect(capture.insertValues).toHaveLength(0)
    expect(capture.store.size).toBe(0)
  })
})
