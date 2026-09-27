// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay admin 面 4 个删除端点的测试覆盖(第五十二批登记项「relay admin 4 个删除端点零测试覆盖」收口)。
 *
 * 覆盖面(PROJECT_PLAN 第五十一波·续五 (relay 管理面) 格逐字点名的四个):
 *  1. DELETE /api/admin/relay/peak-pricing/rules/:id        (admin/relay-peak-pricing.ts)
 *  2. DELETE /api/admin/admin/relay/pricing/discounts/:id   (admin/relay-pricing.ts,插件挂 /api/admin 前缀)
 *  3. DELETE /api/admin/relay/prompt-audit/rules/:id        (admin/relay-prompt-audit.ts)
 *  4. DELETE /api/admin/relay/user-attributes/:userId/:key  (admin/relay-user-attributes.ts)
 *
 * 每个端点钉三条不变量(AGENTS §5「已登录不等于可以动这条数据」+ 守门 134 计数诚实性):
 *  A. 未授权(匿名 401 / roleId=0 普通用户 403)⇒ **删除链一条都没发出** —— 只断 401/403 会放过
 *     「先改了再抛 403」与「授权判定发生在查库之后」两种写法,故断言 capture.deleteStarted === 0
 *     且 capture.whereSeen === 0(取证口径同 b28-bool-write-ack.test.ts 的 capture.whereArgs)。
 *  B. admin + 库侧命中 0 行(writeRows 为空)⇒ 404,不得回 deleted:true(删除 ack 必须由
 *    RETURNING 集合派生,不能是常量)。
 *  C. admin + 命中 ⇒ 200 deleted:true,且 where 谓词**确实发出**(whereSeen ≥ 1)。
 *
 * 夹具与真 drizzle 同形:update()/delete() 经 where() 后的产物既可 await 也可再 .returning()
 *(同形写法见 b28-bool-write-ack.test.ts / oss-files-delete.test.ts)。第二十七批实测登记过:
 * peak-pricing-service.test.ts 的 db 夹具是 `{db:{}}` 整层空对象,结构上跑不了删除链 —— 本文件
 * 用可捕获 where/RETURNING 的链式夹具补上那一格(摘掉服务里的 .returning() 会被 B 组用例拦住)。
 *
 * 隔离纪律(§5 测试隔离铁律):全程 mock ../src/db/index.js,不连任何真实 PostgreSQL/Redis;
 * authenticate 被替换为按 principal 旋钮注入 jwtPayload 的夹具,admin 判定走**真实**
 * requireAdmin/resolveAdminRoleId 逻辑(只 mock 它的凭据来源,不 mock 判据本身)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

const ADMIN_USER_ID = '00000000-0000-4000-8000-0000000000ad'
const USER_ID = '00000000-0000-4000-8000-000000000001'

/** 写链回报与"是否发出查询"的捕获面(每用例 beforeEach 重置)。 */
const capture = vi.hoisted(() => ({
  /** db.delete(...) 被构造的次数 —— 未授权用例判"未发出查询" */
  deleteStarted: 0,
  /** delete 链上 .where(...) 被调用的次数 */
  whereSeen: 0,
  /** delete 链 .where() 收到的参数(证据:归属谓词确实在被发出的那条 SQL 上) */
  whereArgs: [] as unknown[],
  /** UPDATE/DELETE 经 .returning()/await 后回报的"库侧命中集"(RETURNING 唯一旋钮) */
  writeRows: [] as Array<{ id: string }>,
  /** select 链回报的行(本文件四个删除端点不读侧,留扩展位) */
  selectRows: [] as unknown[],
}))

/** 鉴权旋钮:'anonymous' 让 authenticate 抛 401;'user'/'admin' 注入对应 roleId。 */
const principal = vi.hoisted(() => ({
  mode: 'admin' as 'anonymous' | 'user' | 'admin',
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// authenticate 夹具:真实 requireAdmin 只依赖它的两个后果 —— 抛 401 或注入 request.jwtPayload。
// 判据本身(roleId >= 1 的读法与 403 分支)走 require-permission.ts 的**真实现**,不 mock。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    if (principal.mode === 'anonymous') {
      const err = new Error('Authentication required') as Error & { statusCode?: number }
      err.statusCode = 401
      throw err
    }
    const userId = principal.mode === 'admin' ? ADMIN_USER_ID : USER_ID
    request.userId = userId
    request.jwtPayload = { sub: userId, userId, roleId: principal.mode === 'admin' ? 1 : 0 }
  }),
  requireActiveUser: vi.fn(async () => {}),
}))

// 与真 drizzle 同形的可配置链。两处刻意的"非中性"设计,让夹具能拦下本票要防的两种回退:
//  ① .where(...) 计数并把参数存进 capture.whereArgs —— 未授权用例据此判"查询未发出",
//     而不是只断状态码(状态码绿但查询已发出的写法过不了);
//  ② **不带 .returning() 的 await 解析为空结果集**(postgres-js 对无 RETURNING 的写本来
//     不回行数组),只有 .returning() 之后的 await 才回报 writeRows —— 于是"服务里把
//     .returning() 摘掉"会让 200 用例当场变 404,而不是像 `{db:{}}` 空夹具那样无声滑过。
function makeWriteChain(): Record<string, unknown> {
  const returningProxy: Record<string, unknown> = new Proxy(function () {}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(capture.writeRows).then(resolve, reject)
      }
      return returningProxy
    },
    apply() {
      return returningProxy
    },
  })
  const chainProxy: Record<string, unknown> = new Proxy(function () {}, {
    get(_t, prop: string) {
      if (prop === 'where') {
        return (...args: unknown[]) => {
          capture.whereSeen += 1
          capture.whereArgs.push(...args)
          return chainProxy
        }
      }
      if (prop === 'returning') {
        return () => returningProxy
      }
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve([] as unknown[]).then(resolve, reject)
      }
      return chainProxy
    },
    apply() {
      return chainProxy
    },
  })
  return chainProxy
}

function makeSelectChain(): Record<string, unknown> {
  const proxy: Record<string, unknown> = new Proxy(function () {}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(capture.selectRows).then(resolve, reject)
      }
      return proxy
    },
    apply() {
      return proxy
    },
  })
  return proxy
}

function makeDb() {
  return {
    select: () => makeSelectChain(),
    update: () => makeWriteChain(),
    delete: () => {
      capture.deleteStarted += 1
      return makeWriteChain()
    },
    insert: () => makeWriteChain(),
    execute: () => Promise.resolve([]),
  }
}

vi.mock('../src/db/index.js', () => ({
  db: makeDb(),
  dbRead: makeDb(),
  dbClient: {},
}))

import adminRelayPeakPricingRoutes from '../src/routes/admin/relay-peak-pricing.js'
import adminRelayPricingRoutes from '../src/routes/admin/relay-pricing.js'
import adminRelayPromptAuditRoutes from '../src/routes/admin/relay-prompt-audit.js'
import adminRelayUserAttributesRoutes from '../src/routes/admin/relay-user-attributes.js'

beforeEach(() => {
  capture.deleteStarted = 0
  capture.whereSeen = 0
  capture.whereArgs = []
  capture.writeRows = []
  capture.selectRows = []
  principal.mode = 'admin'
})

/** 四张路由表同一形状的注入,新增端点只加一行。 */
const ENDPOINTS: ReadonlyArray<{
  name: string
  plugin: typeof adminRelayPeakPricingRoutes
  url: string
  hitRow: { id: string }
}> = [
  {
    name: 'DELETE /api/admin/relay/peak-pricing/rules/:id',
    plugin: adminRelayPeakPricingRoutes,
    url: '/api/admin/relay/peak-pricing/rules/33',
    hitRow: { id: '33' },
  },
  {
    name: 'DELETE /api/admin/admin/relay/pricing/discounts/:id',
    plugin: adminRelayPricingRoutes,
    url: '/api/admin/admin/relay/pricing/discounts/7',
    hitRow: { id: '7' },
  },
  {
    name: 'DELETE /api/admin/relay/prompt-audit/rules/:id',
    plugin: adminRelayPromptAuditRoutes,
    url: '/api/admin/relay/prompt-audit/rules/5',
    hitRow: { id: '5' },
  },
  {
    name: 'DELETE /api/admin/relay/user-attributes/:userId/:key',
    plugin: adminRelayUserAttributesRoutes,
    url: '/api/admin/relay/user-attributes/00000000-0000-4000-8000-000000000001/tier',
    hitRow: { id: 'attr-1' },
  },
]

async function buildApp(
  plugin: (typeof ENDPOINTS)[number]['plugin'],
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(plugin, { prefix: '/api/admin' })
  await app.ready()
  return app
}

describe.each(ENDPOINTS)('$name', ({ url, plugin, hitRow }) => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildApp(plugin)
  })
  afterAll(async () => {
    await app.close()
  })

  it('admin + 命中 ⇒ 200 deleted:true,且 where 谓词确实发出', async () => {
    capture.writeRows = [hitRow]
    const res = await app.inject({ method: 'DELETE', url })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; data: { deleted?: boolean } }
    expect(body.data.deleted).toBe(true)
    expect(capture.deleteStarted).toBe(1)
    expect(capture.whereSeen).toBeGreaterThanOrEqual(1)
  })

  it('admin + 库侧命中 0 行 ⇒ 404(删除 ack 由 RETURNING 集合派生,不是常量)', async () => {
    capture.writeRows = []
    const res = await app.inject({ method: 'DELETE', url })
    expect(res.statusCode).toBe(404)
    // 授权已成立,查询确实发出但 0 命中 —— 这正是"改了 0 行不得回成功"的另一半
    expect(capture.deleteStarted).toBe(1)
    expect(capture.whereSeen).toBeGreaterThanOrEqual(1)
  })

  it('普通用户(roleId=0)⇒ 403 且**未发出删除查询**(先改后拒的写法过不了这条)', async () => {
    principal.mode = 'user'
    capture.writeRows = [hitRow]
    const res = await app.inject({ method: 'DELETE', url })
    expect(res.statusCode).toBe(403)
    expect(capture.deleteStarted).toBe(0)
    expect(capture.whereSeen).toBe(0)
    expect(capture.whereArgs).toHaveLength(0)
  })

  it('匿名(无 JWT)⇒ 401 且**未发出删除查询**', async () => {
    principal.mode = 'anonymous'
    const res = await app.inject({ method: 'DELETE', url })
    expect(res.statusCode).toBe(401)
    expect(capture.deleteStarted).toBe(0)
    expect(capture.whereSeen).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
