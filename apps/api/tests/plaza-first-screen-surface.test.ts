// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 广场首屏那条请求的真实响应面 + 端上取身份的回归(2026-09-28 立,不连库)。
 *
 * 要判的是两型里的 ① :用户实拍「进 App 广场 tab 首屏就弹『提交的信息有误,请检查后重试』」
 * 到底是 **真 400(参数形状/路径/鉴权头错)**,还是 **401 被降级成 400 文案**。
 * 两型的处置动作完全不同(改调用方 vs 让 status/errorCode 跟着错误一起走),所以必须先判。
 *
 * 本文件用**真实**的 `plazaRoutes`(含它自己 `addHook` 的 preHandler)与**真实**的
 * `checkAuth` / `authenticate` 控制流,只把两处换掉:
 *  - `@ihui/auth` 的验签(测鉴权结论,不测 JWT 密码学);
 *  - `../src/db/index.js` 与 `getUserStatus`(不连库,并顺带能断言"未授权时一条查询都没发")。
 * `config` 按仓内既有离线路由测试(agents-market-public.test.ts)同一写法钉成测试档。
 *
 * 四条判据,每条各配反向对照:
 *  ① 无凭据 → **401 `Authentication required`**(不是 400)。
 *  ② 凭据失效 → **401 `Invalid or expired token`**(不是 400),且响应体**不带 errorCode**
 *     ⇒ 端上唯一能救回"这是鉴权失败"的档只剩 HTTP status。
 *  ③ 带着有效凭据打首屏那条 query → **200** ⇒ "参数形状错"这一假设被否证。
 *  ④ 阳性对照:同一条路由把 pageSize 顶到 999 → **400** ⇒ 证明 ③ 的 200 是判据放过的,
 *     不是"路由压根没跑判据";并把该 400 的原文喂给端上映射,证明**真 400 与 401 在
 *     只取 message 时产出同一句话** —— 这就是实拍那条文案的成因。
 *  另加一条身份链:② 的响应体走共享出口 `apiFailureToError`(带 status)必得
 *     「登录已过期,请重新登录」,只取 message 则落到「提交的信息有误」—— 同一份输入两臂,
 *     把"该改哪一侧"钉死成机器判据而不是散文结论。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'

const { LIST_ROWS, TOTAL_ROWS, USER_ID, dbCalls } = vi.hoisted(() => ({
  LIST_ROWS: [{ id: 'row-1', title: '示例需求', status: 'approved' }] as unknown[],
  TOTAL_ROWS: [{ count: 1 }] as unknown[],
  USER_ID: '11111111-1111-4111-8111-111111111111',
  dbCalls: { select: 0 },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

/**
 * 链式 db 桩:`/list` 一次并发发两条 select —— `select()` 取列表、`select({count})` 取总数。
 * 按投影参数分流,好让 ③ 能断言"真的取到了行"(而不是 handler 提前返回空数组)。
 */
vi.mock('../src/db/index.js', () => {
  const makeChain = (projection: unknown) => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(projection && typeof projection === 'object' ? TOTAL_ROWS : LIST_ROWS).then(
        resolve,
        reject,
      )
    return step
  }
  return {
    db: {
      select: vi.fn((projection?: unknown) => {
        dbCalls.select += 1
        return makeChain(projection)
      }),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => makeChain(undefined)) },
    dbClient: {},
  }
})

// 账号状态给"正常":保证后面两条 401/403 只可能由凭据本身产生,不是由封禁/注销分支产生。
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('@ihui/auth', () => ({
  // 'expired' 这根哨兵字符串模拟 access token 过期 —— 真实路径就是 verify 抛错 → 401。
  // 形状须与真实 jose 一致:jwtVerify 过期抛 JWTExpired,code='ERR_JWT_EXPIRED'
  // (plugins/auth.ts 的三分辨靠它把"会话失效"与"依赖故障 502"分开,见票 G-396/G-765/G-357)。
  verifyAccessToken: vi.fn(async (token: string) => {
    if (token === 'expired') {
      const err = new Error('jwt expired') as Error & { code: string }
      err.code = 'ERR_JWT_EXPIRED'
      throw err
    }
    return { userId: USER_ID, phone: '13800000000', familyId: 'f-1', roleId: 0 }
  }),
  verifyRefreshToken: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
}))

// 验签之后 authenticate 还会 decodeJwt 挑 type==='challenge';给一个普通 payload 即可。
vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ userId: USER_ID, roleId: 0 })),
}))

import { plazaRoutes } from '../src/routes/plaza.js'

/** 首屏那条请求的参数面(apps/mobile-rn/src/screens/PlazaScreen.tsx 里 load() 的初值)。 */
const FIRST_SCREEN_QUERY = 'page=1&pageSize=10&taskStatus=waiting'

const bearer = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` })

describe('GET /api/plaza/list 首屏真实结论面', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    dbCalls.select = 0
    app = Fastify({ logger: false })
    await app.register(plazaRoutes, { prefix: '/api/plaza' })
    await app.ready()
  })

  it('① 无凭据 ⇒ 401 Authentication required(不是 400),且一条查询都不发', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/plaza/list?${FIRST_SCREEN_QUERY}` })
    expect(res.statusCode).toBe(401)
    const body = res.json() as Record<string, unknown>
    expect(body.message).toBe('Authentication required')
    expect(dbCalls.select).toBe(0)
  })

  it('② 凭据失效 ⇒ 401 Invalid or expired token,响应体不带 errorCode(身份只剩 status)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/plaza/list?${FIRST_SCREEN_QUERY}`,
      headers: bearer('expired'),
    })
    expect(res.statusCode).toBe(401)
    const body = res.json() as Record<string, unknown>
    expect(body.message).toBe('Invalid or expired token')
    // 这条断言是本票的支点:errorCode 缺席 ⇒ 端上不走 HTTP status 就无从分辨鉴权失败。
    expect('errorCode' in body).toBe(false)
    expect(dbCalls.select).toBe(0)
  })

  it('③ 有效凭据 + 首屏那条 query ⇒ 200 且取到列表 ⇒ "真 400(参数形状)"被否证', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/plaza/list?${FIRST_SCREEN_QUERY}`,
      headers: bearer('good'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data?: { list?: unknown[]; total?: number; page?: number } }
    expect(body.data?.list).toEqual(LIST_ROWS)
    expect(body.data?.total).toBe(1)
    expect(body.data?.page).toBe(1)
    expect(dbCalls.select).toBeGreaterThan(0)
  })

  it('④ 阳性对照:同一路由 pageSize=999 ⇒ 真 400(证明 ③ 的 200 是判据放过的)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/plaza/list?page=1&pageSize=999&taskStatus=waiting',
      headers: bearer('good'),
    })
    expect(res.statusCode).toBe(400)
    expect(dbCalls.select).toBe(0)
    const fourHundredMessage = (res.json() as { message?: string }).message ?? ''
    // 反向对照的第二半:真 400 的原文喂给端上映射,与 ② 只取 message 的那一臂**同一句话**。
    // ⇒ 实拍那条「提交的信息有误」本身分不出 400/401,只有 status 能分 —— 这正是本票要保住的档。
    expect(toUserFriendlyMessage(new Error(fourHundredMessage))).toBe(
      toUserFriendlyMessage(apiFailureToError({ error: 'Invalid or expired token' })),
    )
  })

  it('⑤ 身份链同一份输入两臂:带 status 得「登录已过期」,只取 message 得「提交的信息有误」', () => {
    // ② 那根响应体逐字搬过来:{ code: 401, message: 'Invalid or expired token' } 无 errorCode
    const withStatus = toUserFriendlyMessage(
      apiFailureToError({ error: 'Invalid or expired token', status: 401 }),
    )
    const messageOnly = toUserFriendlyMessage(
      apiFailureToError({ error: 'Invalid or expired token' }),
    )
    expect(withStatus).toBe('登录已过期,请重新登录')
    expect(messageOnly).toBe('提交的信息有误,请检查后重试')
    // 两臂必须不同形:相同就说明 status 这一档没被判序吃到,本票的支点就没了
    expect(withStatus).not.toBe(messageOnly)
  })

  it('⑥ 未鉴权绝不进 handler:401 那一趟不产生任何 db 调用(副作用没发生)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/plaza/list?${FIRST_SCREEN_QUERY}`,
      headers: bearer('expired'),
    })
    expect(res.statusCode).toBe(401)
    // 只断言状态码会放过"先改了再抛 403"这一型(AGENTS §5 测试口径),这里量的是查询数。
    expect(dbCalls.select).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
