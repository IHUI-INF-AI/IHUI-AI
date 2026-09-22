// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O4 数据作用域机械层 —— 「闸门是真的」补充证明层。
 *
 * 与 `tests/o4-data-scope-gate.test.ts`(判据 / 拦截层 / SQL 取证主体)**刻意不重叠**,
 * 本文件只回答那侧没证的四件事:
 *  P1 归属边界用**真实业务表的他人行**证伪(users 他人行 / orders 他人行 → 403 DATA_SCOPE_DENIED);
 *  P2 `/api/**` 人登录路径在**最恶劣组合(连接确认是超级用户 + 生产)**下零回归,
 *     而同一实例上机器凭据的 scoped 能力照样 503 —— 证明 503 是"按主体分流",
 *     不是全局放行也不是全局拦截;并证清"未挂 principal 插件 = 闸门完全不参与"
 *     (因此 principal 插件的注册位置是硬前提,见 src/server.ts 的 registerPlugins);
 *  P3 每请求开销恒定:N 次请求 = set_config 恰 N 次(四个变量合并成**一条**语句)
 *     + 超级用户探测**恰 1 次**(结果缓存,不给每请求加一次打库);
 *  P4 能力判定自洽性:`config/open-capability-registry.ts` 是 `/api` 面机器入口的唯一事实源,
 *     命中即必然同时具备 capability + apiKey ⇒ 数据闸自动接管,无需逐路由再接线一次。
 *
 * 全 mock:不连生产 PostgreSQL(8810)/ Redis(8811);假客户端只录制,永不联网。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
  type preHandlerAsyncHookHandler,
} from 'fastify'
import { eq, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { postgres } from 'postgres'
import { llmCallLogs, orders, projects, users } from '@ihui/database'
import {
  getCapability,
  type ApiKeyPermission,
  type AuthenticatedApiKey,
  type CapabilityEntry,
} from '@ihui/types'

// ----------------------------------------------------------------------------
// db/index 替身:rls-context 只用到 db.execute。既录制语句,也保证零真实连接。
// ----------------------------------------------------------------------------
const capture = vi.hoisted(() => ({
  contextQueries: [] as unknown[],
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(async (query: unknown): Promise<unknown[]> => {
      capture.contextQueries.push(query)
      return []
    }),
  },
}))

import principalPlugin, { runWithPrincipal, type Principal } from '../src/plugins/principal.js'
import rlsContextPlugin from '../src/plugins/rls-context.js'
import {
  configureDataScopeGuard,
  createScopedDb,
  DATA_SCOPE_ERROR_CODES,
  DataScopeViolationError,
  dbModeForPrincipal,
  isDataScopeEnforced,
  resetSuperuserCache,
} from '../src/utils/scoped-guard.js'
import { isAppError } from '../src/errors/index.js'
import {
  findOpenCapability,
  openCapabilityEntries,
} from '../src/config/open-capability-registry.js'

// ----------------------------------------------------------------------------
// 夹具
// ----------------------------------------------------------------------------
const USER_ID = '11111111-2222-3333-4444-555555555555'
const OTHER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const API_KEY_ID = 'key-proof-1'
const HUMAN_ROLE_ID = 3

const dialect = new PgDialect({ casing: undefined })

/**
 * 借类型断言写凭据字段:避免为一条测试引入 plugins/auth.ts / capability-guard.ts 的
 * 模块增广依赖(那两个文件本用例不改、也不该被 import 拉起 api-key-auth 的 DB 依赖)。
 */
interface CredentialBag {
  apiKey?: AuthenticatedApiKey
  capability?: CapabilityEntry
  userId?: string
  jwtPayload?: { userId: string; roleId: number }
}
const bagOf = (request: FastifyRequest): CredentialBag => request as unknown as CredentialBag

interface RecordedQuery {
  sql: string
  params: unknown[]
}

/** 把 rls-context 写入 mock 的 drizzle 语句编译成 {sql,params}。
 *  未绑方言的 SQL 对象直接读 `.sql`/`.params` 恒为 undefined —— 必须经方言编译。 */
function compiledStatement(query: unknown): RecordedQuery {
  return dialect.sqlToQuery(query as SQL)
}

/** 录制型假 postgres 客户端(drizzle postgres-js 会话所需的最小面)。 */
function makeFakeClient(): { client: postgres.Sql; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = []
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(sqlText: string, params: unknown[] = []) {
      queries.push({ sql: sqlText, params })
      const rows: unknown[] = []
      const promise = Promise.resolve(rows) as Promise<unknown[]> & {
        values: () => Promise<unknown[]>
      }
      promise.values = (): Promise<unknown[]> => Promise.resolve(rows)
      return promise
    },
    begin: async (fn: (inner: unknown) => Promise<unknown>): Promise<unknown> => fn(client),
    end: async (): Promise<void> => {},
  }
  return { client: client as unknown as postgres.Sql, queries }
}

const fake = makeFakeClient()
const rawDb = drizzle(fake.client, { schema: { users, orders, projects, llmCallLogs } })
/** 受控出口 —— 与 src/db/index.ts 的 `dbScoped` 同一个包装函数,证明的是真出口。 */
const scoped = createScopedDb(rawDb)

function machinePrincipal(capability: CapabilityEntry | undefined): Principal {
  return {
    kind: 'apiKey',
    subjectId: USER_ID,
    roleId: 0,
    apiKeyId: API_KEY_ID,
    scopes: [],
    ...(capability ? { capability } : {}),
  }
}

function humanPrincipal(capability?: CapabilityEntry): Principal {
  return {
    kind: 'jwt',
    subjectId: USER_ID,
    roleId: HUMAN_ROLE_ID,
    scopes: [],
    ...(capability ? { capability } : {}),
  }
}

function apiKeyContext(permissions: ApiKeyPermission[]): AuthenticatedApiKey {
  return {
    id: API_KEY_ID,
    userId: USER_ID,
    key: 'ihui_proof',
    permissions,
    rateLimit: 60,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
  }
}

/** 模拟 `requireApiKeyAuth + requireCapability(scope)`:preHandler 阶段注入凭据与能力。 */
function authAsMachine(scope: ApiKeyPermission): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    const bag = bagOf(request)
    bag.apiKey = apiKeyContext([scope])
    bag.userId = USER_ID
    bag.capability = getCapability(scope)
  }
}

/** 模拟 `authenticate()`(人 JWT 链路)。 */
function authAsHuman(): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    const bag = bagOf(request)
    bag.userId = USER_ID
    bag.jwtPayload = { userId: USER_ID, roleId: HUMAN_ROLE_ID }
  }
}

/**
 * 镜像 src/server.ts:129 的 errorHandler 判据(statusCode 透传 + AppError.errorCode)。
 * 镜像而非 import:该函数是 server.ts 的模块私有函数;契约只依赖 `code`/`errorCode`。
 */
function installMirroredErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500
    void reply.status(statusCode).send({
      code: statusCode,
      message: error.message,
      ...(isAppError(error) ? { errorCode: error.errorCode } : {}),
    })
  })
}

/** 与 server.ts 同一注册顺序:principal 插件 → rls-context 插件(经 onRoute 追加 preHandler)。 */
async function buildWiredApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  installMirroredErrorHandler(app)
  // 不在此 ready():插件注册是入队的,inject() 时才 boot —— 用例仍可在返回后挂路由。
  await app.register(principalPlugin)
  await app.register(rlsContextPlugin)
  return app
}

/**
 * 在指定主体上下文内执行一次数据访问,并捕获结果。
 *
 * **关键细节**:drizzle 的 select/insert 构造器是**惰性 thenable**,
 * `prepareQuery`(即闸门所在)是在被 `await` 的那一刻才跑的。所以 try/await
 * 必须整体待在 `principalScope.run` 内部 —— 若写成 `await runWithPrincipal(p, fn)`
 * (在 run 之外 await 返回的 builder),ALS 已退出,闸门会静默不生效。
 * 这既是测试写法,也是对"真请求链路"(onRequest 的 ALS 罩住整条生命周期)的对照说明。
 */
async function attempt(
  principal: Principal,
  fn: () => Promise<unknown> | unknown,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  return runWithPrincipal(
    principal,
    async (): Promise<{ ok: true } | { ok: false; error: unknown }> => {
      try {
        await fn()
        return { ok: true }
      } catch (error) {
        return { ok: false, error }
      }
    },
  )
}

function expectDenied(
  error: unknown,
  errorCode: (typeof DATA_SCOPE_ERROR_CODES)[keyof typeof DATA_SCOPE_ERROR_CODES],
  statusCode: number,
  reason?: string,
): void {
  expect(error).toBeInstanceOf(DataScopeViolationError)
  const err = error as DataScopeViolationError
  expect(err.errorCode).toBe(errorCode)
  // 503 不得被写成 500:statusCode 是对外契约的一部分
  expect(err.statusCode).toBe(statusCode)
  if (reason) expect(err.reason).toBe(reason)
}

let probeCalls = 0
let warnMessages: string[] = []

beforeEach(() => {
  capture.contextQueries.length = 0
  fake.queries.length = 0
  probeCalls = 0
  warnMessages = []
  // 默认最温和组合:普通角色 + 非生产(各用例自行改写这两项)
  configureDataScopeGuard({
    probeSuperuser: async (): Promise<boolean> => {
      probeCalls += 1
      return false
    },
    isProduction: () => false,
    warn: (message): void => {
      warnMessages.push(message)
    },
  })
  resetSuperuserCache()
})

afterEach(() => {
  resetSuperuserCache()
})

/** 敌意环境:连接**确认**是超级用户,且判定为生产 —— 人登录路径必须照样不受影响。 */
function hostileDeps(): void {
  configureDataScopeGuard({
    probeSuperuser: async (): Promise<boolean> => {
      probeCalls += 1
      return true
    },
    isProduction: () => true,
    warn: (message): void => {
      warnMessages.push(message)
    },
  })
}

// ============================================================================
// P1 归属边界:真实业务表的"他人行"进不来
// ============================================================================
describe('O4-P1 scoped-* 访问非归属数据 → 403 DATA_SCOPE_DENIED', () => {
  const readOwned = getCapability('agents:read') // dataClass=scoped-read
  const writeOwned = getCapability('models:write') // dataClass=scoped-write

  it('scoped-read 读 users 的他人一行(users 的 owner 列即主键)→ 拒绝', async () => {
    const result = await attempt(machinePrincipal(readOwned), () =>
      scoped.select({ id: users.id }).from(users).where(eq(users.id, OTHER_ID)),
    )
    expectDenied(result.ok ? new Error('预期被拒却放行') : result.error, 'DATA_SCOPE_DENIED', 403)
    expect(fake.queries).toHaveLength(0)
  })

  it('scoped-read 读 orders 的他人一行 → 拒绝', async () => {
    const result = await attempt(machinePrincipal(readOwned), () =>
      scoped.select({ id: orders.id }).from(orders).where(eq(orders.userId, OTHER_ID)),
    )
    expectDenied(result.ok ? new Error('预期被拒却放行') : result.error, 'DATA_SCOPE_DENIED', 403)
    expect(fake.queries).toHaveLength(0)
  })

  it('scoped-read 读 orders 自己一行 → 放行,且下发的是带 owner 谓词的 SQL', async () => {
    const result = await attempt(machinePrincipal(readOwned), () =>
      scoped.select({ id: orders.id }).from(orders).where(eq(orders.userId, USER_ID)),
    )
    expect(result.ok).toBe(true)
    expect(fake.queries).toHaveLength(1)
    expect(fake.queries[0]?.sql).toContain('"orders"."user_id"')
    expect(fake.queries[0]?.params).toContain(USER_ID)
  })

  it('scoped-write 改写他人 orders 行 → 拒绝(写面与读面同闸,不"写而不拒")', async () => {
    const result = await attempt(machinePrincipal(writeOwned), () =>
      scoped.update(orders).set({ status: 'cancelled' }).where(eq(orders.userId, OTHER_ID)),
    )
    expectDenied(result.ok ? new Error('预期被拒却放行') : result.error, 'DATA_SCOPE_DENIED', 403)
    expect(fake.queries).toHaveLength(0)
  })

  it('compute 能力把 orders 当业务表读 → DATA_ACCESS_DENIED(白名单之外没有例外)', async () => {
    const result = await attempt(machinePrincipal(getCapability('chat:write')), () =>
      scoped.select({ id: orders.id }).from(orders),
    )
    expectDenied(result.ok ? new Error('预期被拒却放行') : result.error, 'DATA_ACCESS_DENIED', 403)
  })

  it('compute 能力写自有运行记录 llm_call_logs → 放行(闸门不误伤"调用自身"的记账)', async () => {
    const result = await attempt(machinePrincipal(getCapability('chat:write')), () =>
      scoped.insert(llmCallLogs).values({ userId: USER_ID, model: 'gpt-4o', prompt: 'ping' }),
    )
    expect(result.ok).toBe(true)
    expect(fake.queries[0]?.sql).toContain('"llm_call_logs"')
    expect(fake.queries[0]?.params).toContain(USER_ID)
  })
})

// ============================================================================
// P2 /api 人登录路径零回归(最恶劣组合)+ 机器路径按主体分流
// ============================================================================
describe('O4-P2 /api 人登录路径零回归,机器路径按主体分流', () => {
  it('人 JWT 读业务表:200、SQL 照发、探针一次都没被打', async () => {
    hostileDeps()
    const app = await buildWiredApp()
    app.get('/api/account', { preHandler: [authAsHuman()] }, async () =>
      scoped.select({ id: users.id }).from(users),
    )
    const res = await app.inject({ method: 'GET', url: '/api/account' })
    await app.close()

    expect(res.statusCode).toBe(200)
    expect(fake.queries).toHaveLength(1)
    // 零回归的机械依据:人链路既不触发探测,也不产生任何告警
    expect(probeCalls).toBe(0)
    expect(warnMessages).toEqual([])
  })

  it('同一实例 + 同一敌意环境:机器凭据的 scoped 能力在 preHandler 阶段即 503,handler 没跑', async () => {
    hostileDeps()
    const app = await buildWiredApp()
    let handlerRan = false
    app.get(
      '/api/leak',
      { preHandler: [authAsMachine('agents:read')] },
      async (): Promise<{ ran: boolean }> => {
        handlerRan = true
        return { ran: true }
      },
    )
    const res = await app.inject({ method: 'GET', url: '/api/leak' })
    await app.close()

    expect(handlerRan).toBe(false)
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ code: 503, errorCode: 'DATA_ISOLATION_UNAVAILABLE' })
    expect(fake.queries).toHaveLength(0)
  })

  it('未挂 principal/rls-context 插件的实例(存量接线原样):闸门完全不参与', async () => {
    hostileDeps()
    const app = Fastify({ logger: false })
    installMirroredErrorHandler(app)
    app.get('/api/legacy', { preHandler: [authAsMachine('agents:read')] }, async () =>
      scoped.select({ id: users.id }).from(users),
    )
    const res = await app.inject({ method: 'GET', url: '/api/legacy' })
    await app.close()

    // 无 ALS 主体上下文 → enforceDbAccessForPreparedQuery 首行 return;无钩子 → 无断言。
    // 结论:数据闸以 principal 插件注册为硬前提(server.ts registerPlugins 已注册)。
    expect(res.statusCode).toBe(200)
    expect(fake.queries).toHaveLength(1)
    expect(probeCalls).toBe(0)
  })

  it('principal 判据本身:人 / internal / 无能力机器凭据都不进闸,机器+能力必进闸', () => {
    const readOwned = getCapability('agents:read')
    expect(isDataScopeEnforced(humanPrincipal(readOwned))).toBe(false)
    expect(isDataScopeEnforced(machinePrincipal(readOwned))).toBe(true)
    expect(isDataScopeEnforced(machinePrincipal(undefined))).toBe(false)
    expect(isDataScopeEnforced(undefined)).toBe(false)
    const internal: Principal = { kind: 'internal', subjectId: USER_ID, roleId: 0, scopes: [] }
    expect(isDataScopeEnforced(internal)).toBe(false)
  })
})

// ============================================================================
// P3 每请求开销恒定(否则"闸门"= 每请求多两次往返)
// ============================================================================
describe('O4-P3 每请求开销恒定', () => {
  it('四条会话变量合并为**一条**语句,每请求恰一次往返,值取自鉴权后的 principal', async () => {
    const app = await buildWiredApp()
    app.get('/api/me', { preHandler: [authAsHuman()] }, async () => ({ ok: true }))
    const res = await app.inject({ method: 'GET', url: '/api/me' })
    await app.close()

    expect(res.statusCode).toBe(200)
    const statements = capture.contextQueries.map(compiledStatement)
    expect(statements).toHaveLength(1)
    const statement = statements[0]
    if (!statement) throw new Error('未捕获到上下文语句')
    expect(statement.sql).toContain('set_config')
    // 新契约名 + 旧兼容名同时下发
    for (const name of [
      'app.user_id',
      'app.api_key_id',
      'app.current_user_id',
      'app.current_user_role',
    ]) {
      expect(statement.sql).toContain(name)
    }
    expect(statement.params).toContain(USER_ID)
    expect(statement.params).toContain(String(HUMAN_ROLE_ID))
  })

  it('机器请求:app.api_key_id 与 app.user_id 都落真值(可被策略函数消费)', async () => {
    const app = await buildWiredApp()
    app.get('/v1/mine', { preHandler: [authAsMachine('agents:read')] }, async () =>
      scoped.select({ id: projects.id }).from(projects).where(eq(projects.userId, USER_ID)),
    )
    const res = await app.inject({ method: 'GET', url: '/v1/mine' })
    await app.close()

    expect(res.statusCode).toBe(200)
    const statement = capture.contextQueries.map(compiledStatement).at(-1)
    expect(statement?.params).toEqual([USER_ID, API_KEY_ID, USER_ID, '0'])
  })

  it('N 次请求:N 次上下文写入 + 超级用户探测**恰 1 次**', async () => {
    let localProbes = 0
    configureDataScopeGuard({
      probeSuperuser: async (): Promise<boolean> => {
        localProbes += 1
        return false
      },
      isProduction: () => true,
    })
    const app = await buildWiredApp()
    app.get('/v1/scoped', { preHandler: [authAsMachine('agents:read')] }, async () => ({
      ok: true,
    }))
    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({ method: 'GET', url: '/v1/scoped' })
      expect(res.statusCode).toBe(200)
    }
    await app.close()

    expect(capture.contextQueries).toHaveLength(5)
    expect(localProbes).toBe(1)
  })

  it('探针抛错(连接抖动)也不会每请求重打:不可用结论同样进缓存', async () => {
    let attempts = 0
    configureDataScopeGuard({
      probeSuperuser: async (): Promise<boolean> => {
        attempts += 1
        throw new Error('connection reset')
      },
      isProduction: () => true,
    })
    const { assertNonSuperuserForScopedMode } = await import('../src/utils/scoped-guard.js')
    const statuses: number[] = []
    for (let i = 0; i < 4; i += 1) {
      await assertNonSuperuserForScopedMode('read-owned').catch((error: unknown) => {
        statuses.push((error as DataScopeViolationError).statusCode ?? 0)
      })
    }
    expect(attempts).toBe(1)
    expect(statuses).toEqual([503, 503, 503, 503])
  })
})

// ============================================================================
// P4 能力判定自洽性:登记表 = /api 面唯一事实源(无需逐路由再接线)
// ============================================================================
describe('O4-P4 能力判定无需逐路由接线(登记表自洽)', () => {
  /** 把路径模式还原成一条必然命中的具体路径(`:param` → x-1;表中已无通配条目)。 */
  function concretePaths(pattern: string): string[] {
    const segments = pattern
      .split('/')
      .map((segment) => (segment.startsWith(':') ? 'x-1' : segment))
    const literal = segments.filter((segment) => segment !== '*').join('/')
    return pattern.endsWith('/*') ? [`${literal}/anything`, literal] : [literal]
  }

  it('登记表每个条目都能被 findOpenCapability 命中(方法/路径未漂移)', () => {
    const entries = openCapabilityEntries()
    expect(entries.length).toBeGreaterThan(0)
    const missed: string[] = []
    for (const entry of entries) {
      const method = entry.methods[0] === '*' ? 'GET' : (entry.methods[0] ?? 'GET')
      const hit = entry.paths
        .flatMap(concretePaths)
        .some((path) => findOpenCapability(method, path)?.key === entry.key)
      if (!hit) missed.push(entry.key)
    }
    expect(missed).toEqual([])
  })

  it('未登记的 /api 路径 → undefined(默认拒绝,不猜能力)', () => {
    expect(findOpenCapability('GET', '/api/wallet/balance')).toBeUndefined()
    expect(findOpenCapability('DELETE', '/api/skills')).toBeUndefined()
  })

  it('命中登记表的机器请求必然同时具备 capability + apiKey ⇒ 数据闸自动接管', () => {
    for (const entry of openCapabilityEntries()) {
      const principal = machinePrincipal(entry.capability)
      if (!isDataScopeEnforced(principal)) throw new Error(`${entry.key} 未进数据闸`)
      // 也绝不落进 unrestricted / forbidden:platform 域在登记表构建期已被拒
      const mode = dbModeForPrincipal(principal)
      if (mode === 'unrestricted' || mode === 'forbidden')
        throw new Error(`${entry.key} 模式异常:${mode}`)
    }
  })

  it('同族路径的写条目与只读条目各自精确命中(无通配,互不吞并)', () => {
    expect(findOpenCapability('GET', '/api/v1/customer_service/ticket/t-1/close')?.scope).toBe(
      'messages:write',
    )
    expect(findOpenCapability('GET', '/api/v1/customer_service/ticket')?.scope).toBe(
      'messages:read',
    )
    // 未登记的同族路径(复数 tickets 无注册点)判为不命中 —— 默认拒绝不继承前缀
    expect(findOpenCapability('GET', '/api/v1/customer_service/tickets')).toBeUndefined()
  })

  it('scoped-* 能力经网关放行后,读他人行的语句在出口即被拒(端到端接缝)', async () => {
    const app = await buildWiredApp()
    const skills = openCapabilityEntries().find((entry) => entry.scope === 'skills:read')
    expect(skills?.capability).toBeDefined()
    app.get(
      '/api/skills',
      {
        preHandler: [
          async (request: FastifyRequest): Promise<void> => {
            const bag = bagOf(request)
            bag.apiKey = apiKeyContext(['skills:read'])
            bag.userId = USER_ID
            bag.capability = skills?.capability
          },
        ],
      },
      async () => {
        // 越权读他人项目:即便路由"忘了"写 owner,出口层也会挡
        return scoped
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.userId, OTHER_ID))
      },
    )
    const res = await app.inject({ method: 'GET', url: '/api/skills' })
    await app.close()

    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({
      code: 403,
      errorCode: DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
    })
    expect(fake.queries).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
