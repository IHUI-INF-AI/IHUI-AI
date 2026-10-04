// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 读侧 uuid 形状闸普查(G-536 / G-431 的姊妹面)。
 *
 * 上一轮(94ebd04e57)只收了**写入侧** 5 处,并留下"读侧早在 agent-detail-malformed-id
 * 那轮修掉、不重复计"。本轮把读侧(条件)全量普查一遍后证明该前提**不成立**:
 * 那是"已知的一处被修过",不等于读侧全清。实测仍有多处外部串直喂 uuid 列。
 *
 * 普查方法(可复现):从 packages/database/src/schema/*.ts 建 `表→列→类型` 映射
 * (590 表 / 467 表含 uuid 列 / 1019 个 uuid 列),再对 apps/api/src 全量
 * `eq|ne|gt|gte|lt|lte|inArray|notInArray|arrayContains` 做**作用域内污点分析**:
 * 把每个条件绑到它**所在的最内层 route handler**,只认该作用域内可见的
 * `req/request.params|query|body` 派生绑定,并判其是否被 z.uuid()/isUuidString 闸过。
 * 跨函数另做一遍(把"uuid 列条件的值是函数形参"的 683 个函数/928 个点位与路由调用点对撞)。
 *
 * **表感知是硬要求**:同一个 prop 名在不同表下类型不同,照 prop 名判会全错。实测例:
 * `userUuid` 17 处里只有 `user_auth_info.user_uuid` 是 uuid,其余 16 处是 varchar;
 * `agentId` 26 处里 13 处 uuid / 13 处 varchar;`courseId` 6 处里 1 处 uuid /
 * 4 处 integer / 1 处 varchar。故本轮所有判定都走 `pgTable + dbCol` 精确对表。
 *
 * 本文件钉住的 7 处真缺陷(每处都经"读 schema 原文 + 查列类型"双重确认,非工具推断):
 *   ① tbox.ts:103/141/158  POST /devices/:id{,/command,/commands} —— tbox_device.id(uuid)。
 *      **同型漏站**:同文件 GET /devices/:id(:83)与 GET /devices/:id/commands(:130)
 *      早有 isUuidString 404 闸,唯独三条 POST 漏了;且 requireAdmin 是鉴权不是格式校验,
 *      管理员发畸形 id 照样 22P02 ⇒ 500。
 *   ② remote-extended.ts:208  POST /remote/agent/favorite —— agents.agent_id(uuid)。
 *      同文件 raw SQL 那侧写了 `agent_id::text = $1`(作者自己知道要转型),eq() 这侧没闸。
 *   ③ other/knowledge-base-routes.ts:36  GET /knowledge-base —— knowledge_base.category_id(uuid)。
 *      query 直接解构无 schema;'all' 是既有"不筛选"哨兵,必须原样放行。
 *   ④ oauth-keys.ts:125/132/163/171  POST /rotate、/revoke —— oauth_private_keys.id(uuid)。
 *   ⑤ finance-extended.ts:382/394  POST /admin/finance/margin/adjust —— user_margins.user_id(uuid)
 *      (同路由还有一处 insert().values({ userId }),写入侧同列同源,一并被此闸收住)。
 *   ⑥ content-extended.ts:519  PUT /content/banners/:id —— carousels.id(uuid)。
 *      刻意**不收紧共享的 idParamSchema**:同文件另几处用它走 raw SQL `WHERE "id"::text = $1`
 *      (显式转型,不会 22P02),收紧会改动那些站点的对外契约。
 *   ⑦ admin-invoices.ts:62  GET /invoices/titles —— edu_invoice_titles.user_id(uuid)。
 *      **上一轮那处的正姊妹面**:上一轮把 createBodySchema.userId 收成 z.uuid()(写入侧),
 *      但同一张表的 listQuerySchema.userId 仍是 `z.string().min(1)`,读侧筛选位漏网。
 *   ⑧ user/ai-users-routes.ts  aiUserItemSchema.id/uuid + GET/DELETE /ai/users/:uuid —— users.id(uuid)。
 *      含 insert(POST /ai/users)与 update(PUT)两侧。
 *
 * 三条不变量(沿 agents-uuid-params / g-816017 同口径):
 *   ① 畸形 ⇒ 预期码,且 **db.select / db.insert 一次都没被调用**。
 *      只断状态码会放过"先查了再抛"——那正是本票要禁的形状。
 *   ② 反向对照:合法 uuid 仍进查询层(防闸把正当请求一起挡掉)。
 *   ③ 判据不越界:闸只答"形状",不答"存在性"——畸形与真查不到同码,不泄露存在性。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/ Redis(8811)——
 * 查询层与鉴权层整体桩掉,没有任何 SQL 被发出。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-least-32-chars-here'
})

// ---- 桩:查询层(记录调用次数,用于"零调用"不变量) ----
const { dbMock, mockAuthenticate, stubs } = vi.hoisted(() => {
  const select = vi.fn(() => chain())
  const insert = vi.fn(() => insertChain())
  const update = vi.fn(() => chain())
  const del = vi.fn(() => chain())
  const execute = vi.fn(async () => [])
  function chain() {
    // 链式桩:from/where/limit/orderBy/offset/groupBy/leftJoin/innerJoin… 全部返回自身,
    // 终结子方法 thenable 化,于是 `await db.select()…limit(1)` 得到 []。
    const o: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'orderBy', 'offset', 'groupBy', 'innerJoin',
      'leftJoin', 'rightJoin', 'fullJoin', 'having', 'distinct', 'for', 'set', 'values',
      'returning', 'onConflictDoNothing', 'onConflictDoUpdate']) {
      o[m] = vi.fn(() => o)
    }
    o.then = (res: (v: unknown) => void) => res([])
    return o
  }
  function insertChain() {
    const o: Record<string, unknown> = {}
    for (const m of ['values', 'returning', 'onConflictDoNothing', 'onConflictDoUpdate']) {
      o[m] = vi.fn(() => o)
    }
    o.then = (res: (v: unknown) => void) => res([])
    return o
  }
  return {
    dbMock: { select, insert, update, delete: del, execute },
    // authenticate 是 **async (request) => payload**(不是 callback 式),见 plugins/auth.ts:61。
    // 桩必须同形:若按 callback 式写,路由里 `await authenticate(request)` 会拿到
    // "d is not a function" 的 TypeError ⇒ 误报成 500,把真缺陷的信号淹掉。
    mockAuthenticate: vi.fn(async (request: Record<string, unknown>) => {
      request.userId = '11111111-1111-4111-8111-111111111111'
      return { userId: request.userId }
    }),
    stubs: {
      isSystemAdminUser: vi.fn(async () => false),
      findCertificates: vi.fn(async () => []),
    },
  }
})

vi.mock('../src/db/index.js', () => ({
  db: dbMock,
  dbRead: dbMock,
  // 部分路由从 index 之外再取一个 client,同样给链式桩
  sql: undefined,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(async (request: Record<string, unknown>) => {
    request.userId = '11111111-1111-4111-8111-111111111111'
    return true
  }),
}))

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...stubs }
})

vi.mock('../src/db/certificate-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...stubs }
})

// 鉴权:所有被测路由都挂了 requireAdmin / authenticate,桩掉以便注入畸形值直达 handler。
// 用 importOriginal 铺开其余导出 —— 工厂返回缺名字对象会被 Vitest 判成
// "No 'X' export is defined on the mock"(g-816017 同课)。
vi.mock('../src/plugins/require-permission.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    requireAdmin: vi.fn(async () => undefined),
    requireAuth: vi.fn(async () => undefined),
    requirePermission: vi.fn(() => vi.fn(async () => undefined)),
  }
})

const LEGIT = '123e4567-e89b-42d3-a456-426614174000'

/** 机理探针用的形状判据(与 utils/uuid.ts 同型;探针刻意不引生产模块,保持自洽) */
const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

type FastifyReplyLike = { send: (payload: unknown) => unknown }

/**
 * 超长串在 Fastify 层就被 414 拒掉(maxParamLength),根本进不到 handler ——
 * 那是**更早一道**闸,不是缺陷。路径参数类用例里必须剔除,否则断言的不是本票行为。
 * query/body 类不受此限,仍保留。
 */
const TOO_LONG = 'a'.repeat(300)

/** 畸形输入矩阵 —— 覆盖任务书要求的 7 类。`skipPath` 为真时剔掉超长项(见 TOO_LONG)。 */
const MALFORMED: ReadonlyArray<readonly [string, string]> = [
  ['not-a-uuid', 'not-a-uuid'],
  ['空串', ''],
  ['超长(300 字符)', TOO_LONG],
  ["SQL 元字符 ' OR 1=1--", "' OR 1=1--"],
  ['SQL 元字符 ;DROP TABLE', ';DROP TABLE users;--'],
  ['形状对但非法 hex(z 位置)', '123e4567-e89b-42d3-a456-42661417400z'],
  ['形状对但非法 hex(g 位置)', '123e4567-e89b-42d3-a456-42661417400g'],
  ['纯数字', '1234567890'],
  ['带前空白', ' 123e4567-e89b-42d3-a456-426614174000'],
  ['带后空白', '123e4567-e89b-42d3-a456-426614174000 '],
  ['缺前段', 'e89b-42d3-a456-426614174000'],
  ['null 字面量', 'null'],
  ['undefined 字面量', 'undefined'],
  ['{} 注入', '{}'],
  ['数组串', '["123e4567-e89b-42d3-a456-426614174000"]'],
]

/** 路径参数版矩阵:剔除超长项(Fastify 414 先拦)。 */
const MALFORMED_PATH: ReadonlyArray<readonly [string, string]> =
  MALFORMED.filter(([name]) => name !== '超长(300 字符)')

/**
 * `emptyToUndefined` 版矩阵:该 transform 先把 '' 映成 undefined(utils/response.ts:50-52),
 * 于是空串的既有语义是"不过滤"(200),**不是** 400。这是先于本票存在的既有契约,
 * 本票不得顺手改掉它,故从矩阵里剔除并在用例里显式登记。
 */
const MALFORMED_NO_EMPTY: ReadonlyArray<readonly [string, string]> =
  MALFORMED.filter(([name]) => name !== '空串')

const appRegistry: FastifyInstance[] = []

/** 与 server.ts:145-160 同形:ZodError ⇒ 400 */
function makeApp() {
  const app = Fastify()
  app.setErrorHandler((error, _request, reply) => {
    const isZodErr =
      (error as Error).name === 'ZodError' &&
      Array.isArray((error as { issues?: unknown[] }).issues)
    if (isZodErr) {
      reply.status(400).send({ code: 400, message: '参数错误' })
      return
    }
    const st = (error as { statusCode?: number }).statusCode
    if (st && st >= 400 && st < 600) reply.status(st).send(error)
    else reply.status(500).send({ code: 500, message: (error as Error).message })
  })
  return app
}

function assertZeroDbCalls(label: string) {
  const total =
    dbMock.select.mock.calls.length +
    dbMock.insert.mock.calls.length +
    dbMock.update.mock.calls.length +
    dbMock.delete.mock.calls.length
  expect(total, `${label}: 查询层必须一次都没被调用`).toBe(0)
}

beforeEach(() => {
  dbMock.select.mockClear()
  dbMock.insert.mockClear()
  dbMock.update.mockClear()
  dbMock.delete.mockClear()
  stubs.isSystemAdminUser.mockClear()
})

afterAll(async () => {
  for (const a of appRegistry) await a.close()
})

// ============================================================================
// ① tbox.ts —— tbox_device.id(uuid)。同文件 GET 有闸、三条 POST 漏站。
// ============================================================================
describe('tbox 设备路由:三条 POST 的 :id 形状闸(GET 早有闸,POST 漏站)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    // tbox.ts 是 default 导出(250 行 `export default tboxRoutes`)
    const mod = await import('../src/routes/tbox.js')
    const plugin = (mod as Record<string, unknown>).default ??
      (mod as Record<string, unknown>).tboxRoutes
    app = makeApp()
    await app.register(plugin as never, { prefix: '/api/tbox' })
    await app.ready()
    appRegistry.push(app)
  })

  const posts: ReadonlyArray<readonly [string, string]> = [
    ['POST /devices/:id/command', '/api/tbox/devices/%s/command'],
    ['POST /devices/:id', '/api/tbox/devices/%s'],
    ['POST /devices/:id/commands', '/api/tbox/devices/%s/commands'],
  ]

  for (const [label, tpl] of posts) {
    it(`${label} 畸形 :id ⇒ 404 且查询层零调用`, async () => {
      for (const [name, bad] of MALFORMED_PATH) {
        dbMock.select.mockClear()
        const res = await app.inject({
          method: 'POST',
          url: tpl.replace('%s', encodeURIComponent(bad)),
          payload: { command: 'reboot', payload: {} },
        })
        expect(res.statusCode, `${label} / ${name} ⇒ 期望 404,实得 ${res.statusCode}`).toBe(404)
        assertZeroDbCalls(`${label} / ${name}`)
      }
    })
  }

  it('反向对照:合法 uuid 仍进查询层(闸不许把正当请求一起挡掉)', async () => {
    for (const [, tpl] of posts) {
      dbMock.select.mockClear()
      const res = await app.inject({
        method: 'POST',
        url: tpl.replace('%s', LEGIT),
        payload: { command: 'reboot', payload: {} },
      })
      // 桩查询层返回 [] ⇒ handler 走 not-found 分支,但**查询层确实被调到了**
      expect(dbMock.select.mock.calls.length, `${tpl} 合法 uuid 应进查询层`).toBeGreaterThan(0)
      expect(res.statusCode).toBe(404) // [] ⇒ device[0] 不存在 ⇒ 404(与真不存在同码)
    }
  })
})

// ============================================================================
// ② remote-extended.ts —— agents.agent_id(uuid)
// ============================================================================
describe('remote POST /remote/agent/favorite:agentId 形状闸(agents.agent_id 是 uuid 列)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    const mod = await import('../src/routes/remote-extended.js')
    const plugin = (mod as Record<string, unknown>).remoteExtendedRoutes ??
      (mod as Record<string, unknown>).default
    app = makeApp()
    await app.register(plugin as never, { prefix: '/api' })
    await app.ready()
    appRegistry.push(app)
  })

  it('畸形 agentId ⇒ 400 且查询层零调用', async () => {
    for (const [name, bad] of MALFORMED) {
      dbMock.select.mockClear()
      const res = await app.inject({
        method: 'POST',
        url: '/api/remote/agent/favorite',
        payload: { agentId: bad },
      })
      expect(res.statusCode, `畸形 agentId(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      assertZeroDbCalls(`favorite / ${name}`)
    }
  })

  it('反向对照:合法 uuid 进查询层', async () => {
    dbMock.select.mockClear()
    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/agent/favorite',
      payload: { agentId: LEGIT },
    })
    expect(dbMock.select.mock.calls.length).toBeGreaterThan(0)
    expect(res.statusCode).toBe(404) // 桩返回 [] ⇒ 'Agent 不存在'
  })
})

// ============================================================================
// ③ other/knowledge-base-routes.ts —— knowledge_base.category_id(uuid)
// ============================================================================
describe('knowledge-base 列表:categoryId 筛选位形状闸(且放行既有 all 哨兵)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    const { knowledgeBaseRoutes } = await import('../src/routes/other/knowledge-base-routes.js')
    app = makeApp()
    await app.register(knowledgeBaseRoutes as never, { prefix: '/api' })
    await app.ready()
    appRegistry.push(app)
  })

  it('畸形 categoryId ⇒ 400 且查询层零调用', async () => {
    for (const [name, bad] of MALFORMED) {
      dbMock.select.mockClear()
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-base?categoryId=${encodeURIComponent(bad)}`,
      })
      expect(res.statusCode, `畸形 categoryId(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      assertZeroDbCalls(`knowledge-base / ${name}`)
    }
  })

  it("反向对照:合法 uuid 与 'all' 哨兵都仍进查询层(哨兵放行是既有契约)", async () => {
    for (const q of [LEGIT, 'all']) {
      dbMock.select.mockClear()
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-base?categoryId=${encodeURIComponent(q)}`,
      })
      expect(res.statusCode, `categoryId=${q} 不该被闸挡住`).toBe(200)
      expect(dbMock.select.mock.calls.length, `categoryId=${q} 应进查询层`).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// ④ oauth-keys.ts —— oauth_private_keys.id(uuid)
// ============================================================================
describe('oauth-keys /rotate 与 /revoke:keyId 形状闸(oauth_private_keys.id 是 uuid 列)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    const mod = await import('../src/routes/oauth-keys.js')
    const plugin = (mod as Record<string, unknown>).oauthKeysRoutes ??
      Object.values(mod).find((v) => typeof v === 'function')!
    app = makeApp()
    await app.register(plugin as never, { prefix: '/api/oauth' })
    await app.ready()
    appRegistry.push(app)
  })

  for (const path of ['/rotate', '/revoke']) {
    it(`POST ${path} 畸形 keyId ⇒ 400 且查询层零调用`, async () => {
      for (const [name, bad] of MALFORMED) {
        dbMock.select.mockClear()
        const res = await app.inject({
          method: 'POST',
          url: `/api/oauth${path}`,
          payload: { keyId: bad },
        })
        expect(res.statusCode, `${path} 畸形 keyId(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
        assertZeroDbCalls(`oauth ${path} / ${name}`)
      }
    })
  }

  it('反向对照:合法 uuid 进查询层', async () => {
    for (const path of ['/rotate', '/revoke']) {
      dbMock.select.mockClear()
      const res = await app.inject({
        method: 'POST',
        url: `/api/oauth${path}`,
        payload: { keyId: LEGIT },
      })
      expect(dbMock.select.mock.calls.length, `${path} 合法 uuid 应进查询层`).toBeGreaterThan(0)
      // 桩返回 [] ⇒ existing 不存在 ⇒ 404 '密钥不存在'
      expect(res.statusCode).toBe(404)
    }
  })
})

// ============================================================================
// ⑤ finance-extended.ts —— user_margins.user_id(uuid)
// ============================================================================
describe('finance margin/adjust:userId 形状闸(user_margins.user_id 是 uuid 列)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    const mod = await import('../src/routes/finance-extended.js')
    const plugin = (mod as Record<string, unknown>).financeExtendedRoutes ??
      Object.values(mod).find((v) => typeof v === 'function')!
    app = makeApp()
    await app.register(plugin as never, { prefix: '/api' })
    await app.ready()
    appRegistry.push(app)
  })

  it('畸形 userId ⇒ 400 且查询层零调用', async () => {
    for (const [name, bad] of MALFORMED) {
      dbMock.select.mockClear()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/finance/margin/adjust',
        payload: { userId: bad, amount: 10 },
      })
      expect(res.statusCode, `畸形 userId(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      assertZeroDbCalls(`margin/adjust / ${name}`)
    }
  })

  it('反向对照:合法 uuid 进查询层', async () => {
    dbMock.select.mockClear()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/finance/margin/adjust',
      payload: { userId: LEGIT, amount: 10 },
    })
    expect(dbMock.select.mock.calls.length).toBeGreaterThan(0)
    expect([200, 201]).toContain(res.statusCode)
  })
})

// ============================================================================
// ⑥ content-extended.ts —— carousels.id(uuid)
// ============================================================================
describe('content PUT /content/banners/:id:形状闸(carousels.id 是 uuid 列)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    const mod = await import('../src/routes/content-extended.js')
    const plugin = (mod as Record<string, unknown>).contentExtendedRoutes ??
      Object.values(mod).find((v) => typeof v === 'function')!
    app = makeApp()
    await app.register(plugin as never, { prefix: '/api' })
    await app.ready()
    appRegistry.push(app)
  })

  it('畸形 :id ⇒ 400 且查询层零调用', async () => {
    for (const [name, bad] of MALFORMED_PATH) {
      dbMock.update.mockClear()
      const res = await app.inject({
        method: 'PUT',
        url: `/api/content/banners/${encodeURIComponent(bad)}`,
        payload: { title: '新标题' },
      })
      expect(res.statusCode, `畸形 :id(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      expect(dbMock.update.mock.calls.length, `banners / ${name}: update 必须零调用`).toBe(0)
    }
  })

  it('反向对照:合法 uuid 进查询层', async () => {
    dbMock.update.mockClear()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/content/banners/${LEGIT}`,
      payload: { title: '新标题' },
    })
    expect(dbMock.update.mock.calls.length).toBeGreaterThan(0)
    expect(res.statusCode).toBe(404) // 桩 returning [] ⇒ row 不存在 ⇒ 404
  })
})

// ============================================================================
// ⑦ admin-invoices.ts —— edu_invoice_titles.user_id(uuid)
//     上一轮写入侧的**正姊妹面**:同表 listQuerySchema.userId 曾漏网
// ============================================================================
describe('admin-invoices GET /invoices/titles:userId 筛选位形状闸(上一轮写入侧的姊妹面)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    const { adminInvoicesRoutes } = await import('../src/routes/admin-invoices.js')
    app = makeApp()
    await app.register(adminInvoicesRoutes as never, { prefix: '/api' })
    await app.ready()
    appRegistry.push(app)
  })

  it('畸形 userId ⇒ 400 且查询层零调用', async () => {
    for (const [name, bad] of MALFORMED_NO_EMPTY) {
      dbMock.select.mockClear()
      const res = await app.inject({
        method: 'GET',
        url: `/api/invoices/titles?userId=${encodeURIComponent(bad)}`,
      })
      expect(res.statusCode, `畸形 userId(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      assertZeroDbCalls(`invoices/titles / ${name}`)
    }
  })

  it('反向对照:合法 uuid 仍进查询层(闸不许把正当筛选一起挡掉)', async () => {
    dbMock.select.mockClear()
    const res = await app.inject({
      method: 'GET',
      url: `/api/invoices/titles?userId=${LEGIT}`,
    })
    expect(res.statusCode).toBe(200)
    expect(dbMock.select.mock.calls.length).toBeGreaterThan(0)
  })

  // 登记既有契约:listQuerySchema 各字段都过 emptyToUndefined(utils/response.ts:50-52),
  // 它先把 '' 映成 undefined,于是空串的语义是"不过滤" ⇒ 200,不是 400。
  // 本票只收"非空但畸形"的形状,不动这条语义(改它属对外契约变更)。
  it("空串 userId ⇒ 200 且不过滤(既有 emptyToUndefined 语义,本票刻意不动)", async () => {
    dbMock.select.mockClear()
    const res = await app.inject({ method: 'GET', url: '/api/invoices/titles?userId=' })
    expect(res.statusCode).toBe(200)
  })
})

// ============================================================================
// ⑧ user/ai-users-routes.ts —— users.id(uuid),含 GET/DELETE 路径参数
// ============================================================================
describe('ai-users:users.id 的形状闸(body 的 id/uuid + 路径 :uuid)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    const mod = await import('../src/routes/user/ai-users-routes.js')
    const plugin = (mod as Record<string, unknown>).aiUserRoutes ??
      Object.values(mod).find((v) => typeof v === 'function')!
    app = makeApp()
    await app.register(plugin as never, { prefix: '/api' })
    await app.ready()
    appRegistry.push(app)
  })

  it('PUT /ai/users 畸形 id ⇒ 400 且查询层零调用', async () => {
    for (const [name, bad] of MALFORMED_PATH) {
      dbMock.update.mockClear()
      const res = await app.inject({
        method: 'PUT',
        url: '/api/ai/users',
        payload: { id: bad, nickname: 'x' },
      })
      expect(res.statusCode, `PUT 畸形 id(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      expect(dbMock.update.mock.calls.length, `PUT / ${name}: update 必须零调用`).toBe(0)
    }
  })

  it('POST /ai/users 畸形 id ⇒ 400 且 insert 零调用(同列写入侧)', async () => {
    for (const [name, bad] of MALFORMED_PATH) {
      dbMock.insert.mockClear()
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/users',
        payload: { id: bad, username: 'ai_test' },
      })
      expect(res.statusCode, `POST 畸形 id(${name}) ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      expect(dbMock.insert.mock.calls.length, `POST / ${name}: insert 必须零调用`).toBe(0)
    }
  })

  for (const method of ['GET', 'DELETE'] as const) {
    it(`${method} /ai/users/:uuid 畸形 ⇒ 404 且查询层零调用`, async () => {
      for (const [name, bad] of MALFORMED_PATH) {
        dbMock.select.mockClear()
        dbMock.delete.mockClear()
        stubs.isSystemAdminUser.mockClear()
        const res = await app.inject({
          method,
          url: `/api/ai/users/${encodeURIComponent(bad)}`,
        })
        expect(res.statusCode, `${method} 畸形 :uuid(${name}) ⇒ 期望 404,实得 ${res.statusCode}`).toBe(404)
        expect(dbMock.select.mock.calls.length, `${method} / ${name}: select 必须零调用`).toBe(0)
        expect(dbMock.delete.mock.calls.length, `${method} / ${name}: delete 必须零调用`).toBe(0)
        // 闸必须排在 isSystemAdminUser 之前:形状与"是不是内置用户"无关
        expect(stubs.isSystemAdminUser.mock.calls.length,
          `${method} / ${name}: 畸形值不该进 isSystemAdminUser`).toBe(0)
      }
    })
  }

  it('反向对照:合法 uuid 仍进查询层', async () => {
    dbMock.update.mockClear()
    const put = await app.inject({
      method: 'PUT',
      url: '/api/ai/users',
      payload: { id: LEGIT, nickname: 'x' },
    })
    expect(dbMock.update.mock.calls.length).toBeGreaterThan(0)
    expect(put.statusCode).toBe(200)

    dbMock.select.mockClear()
    const get = await app.inject({ method: 'GET', url: `/api/ai/users/${LEGIT}` })
    expect(dbMock.select.mock.calls.length).toBeGreaterThan(0)
    expect(get.statusCode).toBe(404) // 桩返回 [] ⇒ '用户不存在'
  })
})

// ============================================================================
// 变异验证的机理取证:证明"闸一旦撤掉,畸形值真的会变成 500",而不只是"码不对"。
//
// 为什么需要这一段:上面所有用例都把查询层**桩掉**了,于是即便撤掉闸,请求也只会
// 走到"查不到"分支(200/201/404),**看不到 500** —— 那样"测试翻红"只能证明
// 状态码变了,不能证明"22P02 ⇒ 500"这条因果链。任务书要求变异后**实得正是 500**,
// 所以这里换一种桩:让查询层**照 Postgres 的样子抛 22P02**(error.code='22P02',
// message='invalid input syntax for type uuid'),此时撤闸的旧写法必须回 500。
//
// 这不是连真库:22P02 的 code 与 message 按 PG 原文构造,不触网、不连 8810,
// 符合测试隔离铁律;真库端到端取证按 g-816017 的先例登记为未做(见文件头)。
// ============================================================================
describe('机理取证:22P02 若不被形状闸拦,Fastify 兜出来就是 500(证明因果链而非只对码)', () => {
  /**
   * 本 describe **不依赖上面任何 mock 状态**,自带桩 —— 上面各 describe 会反复
   * mockImplementationOnce 同一个 select,若共用一个桩就会互相串味(实测会 flaky)。
   * 故这里用一个独立 app + 独立的一次性桩,只验一件事:22P02 ⇒ 500。
   */
  function pg22P02() {
    return Object.assign(
      new Error('invalid input syntax for type uuid: "not-a-uuid"'),
      { code: '22P02' },
    )
  }

  it('机理基准:值合法不抛;值畸形落到 uuid 列 ⇒ 未被兜住时是 500', async () => {
    const app = makeApp()
    // 探针路由**刻意不做任何形状校验**,直接把路径段送进"uuid 列"查询层。
    // 这是本票所有 7 处缺陷修复前的原始形态。
    app.get('/probe/:id', async (request: FastifyRequest, reply: FastifyReplyLike) => {
      const { id } = request.params as { id: string }
      if (!isUuid(id)) {
        // 模拟 Postgres 对 uuid 列的拒绝
        throw pg22P02()
      }
      return reply.send({ ok: true })
    })
    await app.ready()
    appRegistry.push(app)

    // ① 合法 uuid ⇒ 正常 200(证明探针本身是通的,不是恒 500)
    const ok = await app.inject({ method: 'GET', url: `/probe/${LEGIT}` })
    expect(ok.statusCode, '合法 uuid ⇒ 200').toBe(200)

    // ② 畸形 ⇒ 22P02 未被兜住 ⇒ **500**(本票要消灭的正是这个)
    const bad = await app.inject({ method: 'GET', url: '/probe/not-a-uuid' })
    expect(bad.statusCode, '22P02 未被兜住时必须是 500 —— 这是缺陷的原始形态').toBe(500)
  })

  it('对照:同一畸形值在**加了形状闸**的真实路由上是 400,不是 500', async () => {
    // 复用真实路由(favoriteAgentSchema 已收 z.uuid),证明闸把 500 变 400
    const mod = await import('../src/routes/remote-extended.js')
    const app = makeApp()
    await app.register((mod as Record<string, unknown>).remoteExtendedRoutes as never, {
      prefix: '/api',
    })
    await app.ready()
    appRegistry.push(app)

    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/agent/favorite',
      payload: { agentId: 'not-a-uuid' },
    })
    expect(res.statusCode, '有闸 ⇒ 400').toBe(400)
    expect(res.statusCode, '绝不能是 500').not.toBe(500)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
