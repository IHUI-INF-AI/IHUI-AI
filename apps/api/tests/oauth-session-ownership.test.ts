// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * OAuth 会话撤销的属主绑定(2026-09-27,守门 117"认证 ≠ 授权"那一族的 TS 侧补票)。
 *
 * 病灶:`DELETE /api/auth/oauth/my-authorized/:sessionId` 走 authenticate 之后,
 * 把**请求里的任意 sessionId** 原样交给 `deleteSession(id)`,而那条 DELETE 的
 * where 只有 `id = ?`。该面不在公开名单里(匿名进不来),所以症状不是"游客可删",
 * 而是"**任何已登录用户填别人的会话 id 就能吊销别人的授权**",并且响应照旧回
 * `deleted: true` —— 调用方无从分辨"撤了自己的"与"撤了别人的"。
 *
 * 判据只有一类,但贯穿到底:**只看最终发出去的那条 SQL**。
 * 替身摆在 `db` 那一层,而不是 `oauth-queries` 那一层 —— 后者会让"路由层"与"DB 层"
 * 要求同一个模块既是真实现又是替身(一个模块只能有一种 mock),两条判据互相抵消。
 * ① where 渲染后必须同时含 "id" 与 "user_id" —— 缺一个就是越权面;
 * ② 端上挂 `?userId=<别人>` 时,SQL 参数里只能出现**令牌主体**,不能出现自报身份;
 * ③ 库侧回空集 ⇒ deleted:false(0 命中不得谎报成删成了);
 * ④ 匿名 ⇒ 401 **且一条查询都没发出**(越权用例断言"未发出",不是断言状态码)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'
import { signAccessToken } from '@ihui/auth'

const capture = vi.hoisted(() => ({
  /** 每次 .where() 的实参 = 那条 SQL 的 where 片段 */
  whereArgs: [] as unknown[],
  /** 下一次 returning() 要回的行集(测试据此造"删到了"与"0 命中") */
  hitRows: [] as Array<{ id: string }>,
}))

vi.mock('../src/db/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    db: {
      delete: () => ({
        where: (w: unknown) => {
          capture.whereArgs.push(w)
          return {
            returning: () => Promise.resolve(capture.hitRows.splice(0, capture.hitRows.length)),
          }
        },
      }),
    },
  }
})

// authenticate 验签后查一次用户状态(P2-14 加固),只换掉那一次 DB 查询
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

import { deleteSession } from '../src/db/oauth-queries'
import authPlugin from '../src/plugins/auth'
import { authExtendedRoutes } from '../src/routes/auth-extended'

const OWNER = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'
const VICTIM = '11111111-2222-4333-8444-555555555555'
const SESSION_ID = 'sess-abcdef'

let accessToken = ''

function authHeader(): Record<string, string> {
  if (!accessToken) throw new Error('accessToken 未签发:顶层 beforeAll 没跑到')
  return { authorization: `Bearer ${accessToken}` }
}

/** 把捕获到的 where 片段渲染成真 SQL(比扒 drizzle 的 queryChunks 内部结构稳) */
function lastWhereSql(): { sql: string; params: unknown[] } {
  const arg = capture.whereArgs[capture.whereArgs.length - 1]
  if (arg === undefined) throw new Error('一条查询都没发出:capture.whereArgs 为空')
  const q = new PgDialect().sqlToQuery(arg as never)
  return { sql: q.sql, params: q.params as unknown[] }
}

beforeAll(async () => {
  accessToken = await signAccessToken({
    userId: OWNER,
    phone: '',
    familyId: 'f-oauth-ownership',
    roleId: 0,
  })
})

beforeEach(() => {
  capture.whereArgs.length = 0
  capture.hitRows.length = 0
})

describe('① deleteSession 的 SQL 必须带属主条件', () => {
  it('where 渲染后同时含 "id" 与 "user_id",参数两个', async () => {
    capture.hitRows.push({ id: SESSION_ID })
    const removed = await deleteSession(SESSION_ID, OWNER)

    expect(capture.whereArgs).toHaveLength(1)
    const { sql, params } = lastWhereSql()
    expect(sql).toContain('"id" =')
    expect(sql).toContain('"user_id" =')
    expect(params).toHaveLength(2)
    expect(params).toContain(SESSION_ID)
    expect(params).toContain(OWNER)
    // 回报的是库侧命中集,不是调用方传进来的那个 id
    expect(removed).toEqual([SESSION_ID])
  })

  it('库里没有这一行(属主不符即为此型)⇒ 回报空集而不是谎报删成', async () => {
    await expect(deleteSession(SESSION_ID, VICTIM)).resolves.toEqual([])
  })

  it('属主参数取自入参而非写死:换一个人调用,SQL 里就得是那个人', async () => {
    await deleteSession(SESSION_ID, VICTIM)
    const { params } = lastWhereSql()
    expect(params).toContain(VICTIM)
    expect(params).not.toContain(OWNER)
  })
})

describe('② 撤销端点把令牌主体交给 SQL,而不是请求自报的 userId', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(authPlugin)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('带 ?userId=<别人> 时,SQL 参数里只有令牌主体、没有那个别人', async () => {
    capture.hitRows.push({ id: SESSION_ID })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/oauth/my-authorized/${SESSION_ID}?userId=${VICTIM}`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ deleted: true })

    const { sql, params } = lastWhereSql()
    expect(sql).toContain('"user_id" =')
    expect(params).toContain(OWNER)
    expect(params).not.toContain(VICTIM)
  })

  it('库侧 0 命中 ⇒ deleted:false(且那条查询确实带了属主条件)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/oauth/my-authorized/${SESSION_ID}`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ deleted: false })
    // 查询确实发出了并带属主 —— 否则"0 命中"可能来自一条漏了 where 的裸删
    expect(lastWhereSql().sql).toContain('"user_id" =')
  })

  it('匿名 ⇒ 401,且一条查询都没发出', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/oauth/my-authorized/${SESSION_ID}`,
    })
    expect(res.statusCode).toBe(401)
    expect(capture.whereArgs).toHaveLength(0)
  })
})
