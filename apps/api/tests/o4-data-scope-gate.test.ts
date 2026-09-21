// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O4 数据作用域机械层测试(principal.ts + utils/scoped-guard.ts + plugins/rls-context.ts)。
 *
 * 全 mock:不连生产 PostgreSQL(8810)/ Redis(8811)。
 * 拦截层用**真实 drizzle 实例 + 录制型假客户端**验证 —— 证明的是"drizzle 出口真的会被挡",
 * 而不是对一个手搓替身调函数。
 *
 * 覆盖(对外 errorCode 三码契约 + 细分 reason):
 *  1. compute 能力读业务表 → 403 DATA_ACCESS_DENIED(select / 关系查询 / 事务内 / 裸 SQL)
 *  2. compute 能力写自有运行记录表(llm_call_logs)→ 放行且真的落库
 *  3. scoped-write 缺 owner 谓词 → 403 DATA_SCOPE_DENIED(reason=OWNER_FILTER_REQUIRED)
 *  4. scoped 带 owner 谓词(含 scopedWhere 产物)→ 放行
 *  5. 未挂 capability 的调用链(JWT / 无上下文 / 未包装出口)行为不变 = 零回归
 *  6. /v1/* 同样设上下文,且发生在鉴权之后(principal 惰性求值修掉旧 onRequest 恒空)
 *  7. 超级用户 → scoped 能力 503 DATA_ISOLATION_UNAVAILABLE(fail-closed,不再只是注释)
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { and, eq, sql, type SQL } from 'drizzle-orm'
import { PgDialect, alias } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import type postgres from 'postgres'
import { files, llmCallLogs, projects, schema, users } from '@ihui/database'
import {
  getCapability,
  type ApiKeyPermission,
  type AuthenticatedApiKey,
  type CapabilityEntry,
} from '@ihui/types'

// ----------------------------------------------------------------------------
// 假 postgres 客户端(录制型):只喂给 drizzle,永不联网
// ----------------------------------------------------------------------------
interface RecordedCall {
  sql: string
  params: unknown[]
}

function makeFakeClient() {
  const calls: RecordedCall[] = []
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(sqlText: string, params: unknown[] = []): Promise<unknown[]> & {
      values: () => Promise<unknown[]>
    } {
      calls.push({ sql: sqlText, params })
      const rows: unknown[] = []
      const promise = Promise.resolve(rows) as Promise<unknown[]> & {
        values: () => Promise<unknown[]>
      }
      promise.values = () => Promise.resolve(rows)
      return promise
    },
    begin: async (fn: (inner: unknown) => Promise<unknown>): Promise<unknown> => fn(client),
    end: async (): Promise<void> => {},
  }
  return { client: client as unknown as postgres.Sql, calls }
}

function buildScopedTestDb() {
  const fake = makeFakeClient()
  const raw = drizzle(fake.client, { schema })
  return { scoped: createScopedDb(raw), calls: fake.calls }
}

// rls-context 只用到 db.execute —— mock 掉即可捕获会话变量写入,不触任何真实连接
const contextCapture = vi.hoisted(() => ({ queries: [] as unknown[] }))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(async (query: unknown) => {
      contextCapture.queries.push(query)
      return []
    }),
  },
}))

// ----------------------------------------------------------------------------
// 被测模块
// ----------------------------------------------------------------------------
import principalPlugin, { runWithPrincipal, type Principal } from '../src/plugins/principal.js'
import rlsContextPlugin, { isScopedContextUrl } from '../src/plugins/rls-context.js'
import {
  assertDbAccessAllowed,
  assertNonSuperuserForScopedMode,
  configureDataScopeGuard,
  createScopedDb,
  createSuperuserProbe,
  DATA_SCOPE_ERROR_CODES,
  DataScopeViolationError,
  dbModeOfCapability,
  hasOwnerPredicate,
  resetSuperuserCache,
  resolveQueryTableNames,
  resolveTableNamesFromMetadata,
  resolveTableNamesFromSql,
  scopedWhere,
  statementKindOf,
  SUPERUSER_PROBE_SQL,
} from '../src/utils/scoped-guard.js'
import { isAppError } from '../src/errors/index.js'

// ----------------------------------------------------------------------------
// 夹具
// ----------------------------------------------------------------------------
const USER_ID = '11111111-2222-3333-4444-555555555555'
const OTHER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const API_KEY_ID = 'key-1'

/** 能力目录取数:未登记即抛(防测试因目录漂移而空跑)。 */
function cap(scope: ApiKeyPermission): CapabilityEntry {
  const entry = getCapability(scope)
  if (!entry) throw new Error(`能力目录未登记: ${scope}`)
  return entry
}

const computeCap = cap('chat:write') // dataClass=compute → self-metadata
const scopedReadCap = cap('agents:read') // → read-owned
const scopedWriteCap = cap('models:write') // → write-owned
const platformCap = cap('publish:operate') // → unrestricted

function machinePrincipal(scope: ApiKeyPermission, capability?: CapabilityEntry): Principal {
  return {
    kind: 'apiKey',
    subjectId: USER_ID,
    roleId: 0,
    apiKeyId: API_KEY_ID,
    scopes: [scope],
    ...(capability ? { capability } : {}),
  }
}

function humanPrincipal(roleId: number): Principal {
  return { kind: 'jwt', subjectId: USER_ID, roleId, scopes: [] }
}

type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown }

/** 在指定主体上下文内执行,并把违规错误作为结果返回(不抛出,便于断言两种结局)。 */
async function attempt<T>(principal: Principal | undefined, fn: () => Promise<T>): Promise<Attempt<T>> {
  const body = async (): Promise<Attempt<T>> => {
    try {
      return { ok: true, value: await fn() }
    } catch (error) {
      return { ok: false, error }
    }
  }
  return principal ? await runWithPrincipal(principal, body) : await body()
}

/** 合规查询必须放行:失败时把数据闸的原始理由抛出,便于定位误伤。 */
function expectOk<T>(result: Attempt<T>): T {
  if (!result.ok) {
    const err = result.error as Error & { errorCode?: string }
    throw new Error(
      `预期放行却被数据闸拒绝: [${err?.errorCode ?? '?'}] ${err?.message ?? String(err)}`,
    )
  }
  return result.value
}

/**
 * 断言被数据闸拒绝,并核对"对外 errorCode + 细分 reason"两层契约:
 *  - errorCode:客户端只需认的三个码(DATA_ACCESS_DENIED / DATA_SCOPE_DENIED / DATA_ISOLATION_UNAVAILABLE)
 *  - reason   :排障用细分原因(OWNER_FILTER_REQUIRED / RLS_NOT_ENFORCED / PROBE_*)
 */
function denied(
  result: Attempt<unknown>,
  errorCode: string,
  statusCode = 403,
  reason?: string,
): DataScopeViolationError {
  if (result.ok) throw new Error(`预期被数据闸拒绝,但实际放行了(错误码应为 ${errorCode})`)
  expect(result.error).toBeInstanceOf(DataScopeViolationError)
  const err = result.error as DataScopeViolationError
  expect(err.statusCode).toBe(statusCode)
  expect(err.errorCode).toBe(errorCode)
  if (reason) expect(err.reason).toBe(reason)
  return err
}

const dialect = new PgDialect({ casing: undefined })

/** 解析被 mock 的 db.execute 收到的 SQL 模板。 */
function builtContextQuery(index: number): { sql: string; params: unknown[] } {
  const query = contextCapture.queries[index]
  expect(query).toBeDefined()
  return dialect.sqlToQuery(query as SQL)
}

let scoped = undefined as unknown as ReturnType<typeof buildScopedTestDb>['scoped']
let calls: RecordedCall[] = []

beforeEach(() => {
  contextCapture.queries.length = 0
  const built = buildScopedTestDb()
  scoped = built.scoped
  calls = built.calls
  resetSuperuserCache()
  // 默认注入:非生产 + 非超级用户(第 8 组用例各自改写这两项)
  configureDataScopeGuard({
    probeSuperuser: async () => false,
    isProduction: () => false,
  })
})

afterAll(() => {
  vi.restoreAllMocks()
})

// ============================================================================
// 1. 纯判据 assertDbAccessAllowed
// ============================================================================
describe('O4-1 assertDbAccessAllowed 判据', () => {
  it('dataClass → DB 模式映射与能力目录一致(不另立第二套映射)', () => {
    expect(dbModeOfCapability(computeCap)).toBe('self-metadata')
    expect(dbModeOfCapability(scopedReadCap)).toBe('read-owned')
    expect(dbModeOfCapability(scopedWriteCap)).toBe('write-owned')
    expect(dbModeOfCapability(platformCap)).toBe('unrestricted')
    expect(dbModeOfCapability(undefined)).toBe('unrestricted')
  })

  it('compute(self-metadata):仅白名单表;其余与"表名不可判定"一律拒绝', () => {
    expect(() => assertDbAccessAllowed('llm_call_logs', 'self-metadata')).not.toThrow()
    expect(() => assertDbAccessAllowed('audit_logs', 'self-metadata')).not.toThrow()
    expect(() => assertDbAccessAllowed('users', 'self-metadata')).toThrow(DataScopeViolationError)
    expect(() => assertDbAccessAllowed(undefined, 'self-metadata')).toThrow(DataScopeViolationError)
    try {
      assertDbAccessAllowed(undefined, 'self-metadata')
    } catch (error) {
      expect(String((error as Error).message)).toContain('无法判定目标表')
    }
  })

  it('scoped-*:缺 owner 谓词 → OWNER_FILTER_REQUIRED(缺省即拒);带谓词 → 放行', () => {
    expect(() => assertDbAccessAllowed('projects', 'read-owned')).toThrow(DataScopeViolationError)
    expect(() =>
      assertDbAccessAllowed('projects', 'read-owned', { ownerPredicateApplied: false }),
    ).toThrow(DataScopeViolationError)
    try {
      assertDbAccessAllowed('projects', 'write-owned')
    } catch (error) {
      const err = error as DataScopeViolationError
      // 对外码收敛为 DATA_SCOPE_DENIED,细分原因仍是 OWNER_FILTER_REQUIRED
      expect(err.errorCode).toBe(DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED)
      expect(err.reason).toBe(DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED)
      expect(err.statusCode).toBe(403)
    }
    expect(() =>
      assertDbAccessAllowed('projects', 'write-owned', { ownerPredicateApplied: true }),
    ).not.toThrow()
  })

  it('unrestricted 放行 / forbidden 一律拒绝', () => {
    expect(() => assertDbAccessAllowed('users', 'unrestricted')).not.toThrow()
    expect(() => assertDbAccessAllowed('users', 'forbidden')).toThrow(DataScopeViolationError)
  })
})

// ============================================================================
// 2. 取证面:表名解析 / 语句类型 / owner 证据
// ============================================================================
describe('O4-2 表名解析 / 语句类型 / owner 证据', () => {
  it('从编译产物 SQL 解析表名(schema 限定、join、别名、表函数、子查询)', () => {
    expect(resolveTableNamesFromSql('select * from "users"')).toEqual(['users'])
    expect(resolveTableNamesFromSql('select * from "public"."users" "u"')).toEqual(['users'])
    expect(resolveTableNamesFromSql('select * from "a" join "b" on true')).toEqual(['a', 'b'])
    expect(resolveTableNamesFromSql('insert into "projects" ("id") values ($1)')).toEqual([
      'projects',
    ])
    expect(resolveTableNamesFromSql('update "files" set "name" = $1')).toEqual(['files'])
    expect(resolveTableNamesFromSql('delete from "users"')).toEqual(['users'])
    expect(resolveTableNamesFromSql('select * from unnest($1)')).toEqual([])
    expect(resolveTableNamesFromSql('select * from (select * from "orders") "sq"')).toEqual([
      'orders',
    ])
  })

  it('metadata 表名解析:drizzle 实际下发字符串形态(schema.baseName),表对象亦兼容', () => {
    // drizzle 0.45 extractUsedTable() → ['llm_call_logs'] / ['public.users'] 字符串形态
    expect(resolveTableNamesFromMetadata({ type: 'select', tables: ['llm_call_logs'] })).toEqual([
      'llm_call_logs',
    ])
    expect(resolveTableNamesFromMetadata({ tables: ['public.users', 'users'] })).toEqual(['users'])
    // 表对象形态(含别名)也还原成物理名
    expect(resolveTableNamesFromMetadata({ tables: [llmCallLogs] })).toEqual(['llm_call_logs'])
    expect(resolveTableNamesFromMetadata({ tables: [alias(users, 'u')] })).toEqual(['users'])
    expect(resolveTableNamesFromMetadata(undefined)).toEqual([])
    expect(resolveTableNamesFromMetadata({ tables: [42] })).toEqual([])
    expect(resolveQueryTableNames(undefined, 'select * from "llm_call_logs"')).toEqual([
      'llm_call_logs',
    ])
  })

  it('语句类型判定(with / 其他 → other)', () => {
    expect(statementKindOf('  SELECT 1')).toBe('select')
    expect(statementKindOf('insert into "t" values (1)')).toBe('insert')
    expect(statementKindOf('UPDATE "t" SET a=1')).toBe('update')
    expect(statementKindOf('delete from "t"')).toBe('delete')
    expect(statementKindOf('with "sq" as (select 1) select * from "sq"')).toBe('other')
  })

  it('owner 证据:WHERE + owner 列引用 + 主体 ID 绑定,三者缺一不可', () => {
    const base = { subjectId: USER_ID, tables: ['projects'] as string[], kind: 'select' as const }
    expect(
      hasOwnerPredicate({
        ...base,
        sqlText: 'select * from "projects" where "projects"."user_id" = $1',
        params: [USER_ID],
      }),
    ).toBe(true)
    expect(
      hasOwnerPredicate({ ...base, sqlText: 'select * from "projects"', params: [USER_ID] }),
    ).toBe(false)
    expect(
      hasOwnerPredicate({
        ...base,
        sqlText: 'select * from "projects" where "projects"."name" = $1',
        params: ['x'],
      }),
    ).toBe(false)
    expect(
      hasOwnerPredicate({
        ...base,
        sqlText: 'select * from "projects" where "projects"."user_id" = $1',
        params: [OTHER_ID],
      }),
    ).toBe(false)
    expect(
      hasOwnerPredicate({ ...base, tables: [], sqlText: 'select 1', params: [USER_ID] }),
    ).toBe(false)
  })

  it('files 的 owner 列是 uploaded_by;users 的 owner 列是主键 id', () => {
    expect(
      hasOwnerPredicate({
        tables: ['files'],
        kind: 'select',
        sqlText: 'select * from "files" where "files"."uploaded_by" = $1',
        params: [USER_ID],
        subjectId: USER_ID,
      }),
    ).toBe(true)
    expect(
      hasOwnerPredicate({
        tables: ['users'],
        kind: 'select',
        sqlText: 'select "users"."id" from "users" where "users"."id" = $1',
        params: [USER_ID],
        subjectId: USER_ID,
      }),
    ).toBe(true)
    // 裸 "id"(未限定)不足以证明 owner 谓词
    expect(
      hasOwnerPredicate({
        tables: ['users'],
        kind: 'select',
        sqlText: 'select "id" from "users" where "id" = $1',
        params: [USER_ID],
        subjectId: USER_ID,
      }),
    ).toBe(false)
  })
})

// ============================================================================
// 3. 拦截层:真实 drizzle 出口被挡(核心交付)
// ============================================================================
describe('O4-3 dbScoped() 拦截层 —— compute 只出算力、不出数据', () => {
  it('compute 能力 dbScoped().select().from(users) → DATA_ACCESS_DENIED,且未发出任何 SQL', async () => {
    const result = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.select().from(users),
    )
    const err = denied(result, DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED)
    expect(err.mode).toBe('self-metadata')
    expect(calls).toHaveLength(0)
  })

  it('compute 能力关系查询 dbScoped().query.users.findMany() 同样被挡', async () => {
    const result = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.query.users.findMany(),
    )
    denied(result, DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED)
    expect(calls).toHaveLength(0)
  })

  it('compute 能力事务内语句也被挡(transaction 未漏防)', async () => {
    const result = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.transaction(async (tx) => tx.select().from(users)),
    )
    denied(result, DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED)
    expect(calls).toHaveLength(0)
  })

  it('compute 能力裸 SQL 取不到表名 → 默认拒绝(不静默放行)', async () => {
    const result = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.execute(sql`select 1`),
    )
    const err = denied(result, DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED)
    expect(String(err.message)).toContain('无法判定目标表')
  })

  it('compute 能力写自有运行记录表 llm_call_logs → 放行且真的落库', async () => {
    const result = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.insert(llmCallLogs).values({ userId: USER_ID, model: 'gpt-4o', prompt: 'hi' }),
    )
    expectOk(result)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.sql).toContain('"llm_call_logs"')
  })

  it('compute 能力读自身运行记录(计费/审计自读)→ 放行', async () => {
    const result = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.select({ id: llmCallLogs.id }).from(llmCallLogs).where(eq(llmCallLogs.userId, USER_ID)),
    )
    expectOk(result)
  })

  it('表别名不造成判定漂移:别名后的白名单表放行,别名后的业务表仍被挡', async () => {
    const logs = alias(llmCallLogs, 'l')
    const allowed = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.select({ id: logs.id }).from(logs),
    )
    expectOk(allowed)

    const u = alias(users, 'u')
    const blocked = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      scoped.select({ id: u.id }).from(u),
    )
    denied(blocked, DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED)
  })
})

describe('O4-4 dbScoped() 拦截层 —— scoped-* 强制 owner 谓词', () => {
  it('scoped-write 的 update 只过滤主键(无 owner 列)→ OWNER_FILTER_REQUIRED', async () => {
    const result = await attempt(machinePrincipal('models:write', scopedWriteCap), async () =>
      scoped.update(files).set({ name: 'x' }).where(eq(files.id, 'f-1')),
    )
    denied(
      result,
      DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
      403,
      DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED,
    )
    expect(calls).toHaveLength(0)
  })

  it('scoped-write 完全无 where 的 update → OWNER_FILTER_REQUIRED(兼防全表改写)', async () => {
    const result = await attempt(machinePrincipal('models:write', scopedWriteCap), async () =>
      scoped.update(projects).set({ name: 'x' }),
    )
    denied(
      result,
      DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
      403,
      DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED,
    )
  })

  it('scoped-write insert 不写 owner 列 → OWNER_FILTER_REQUIRED', async () => {
    const result = await attempt(machinePrincipal('models:write', scopedWriteCap), async () =>
      // 故意构造缺 owner 列的语句(编译期必填项以断言绕过,验证运行期判据)
      scoped.insert(projects).values({ name: '只有名字' } as unknown as typeof projects.$inferInsert),
    )
    denied(
      result,
      DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
      403,
      DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED,
    )
    expect(calls).toHaveLength(0)
  })

  it('scoped-write insert 归属自己 → 放行', async () => {
    const result = await attempt(machinePrincipal('models:write', scopedWriteCap), async () =>
      scoped.insert(projects).values({ userId: USER_ID, name: '自有项目' }),
    )
    expectOk(result)
    expect(calls[0]?.params).toContain(USER_ID)
  })

  it('scoped-write insert 冒名写他人数据(绑别人 ID)→ OWNER_FILTER_REQUIRED', async () => {
    const result = await attempt(machinePrincipal('models:write', scopedWriteCap), async () =>
      scoped.insert(projects).values({ userId: OTHER_ID, name: '冒名' }),
    )
    denied(
      result,
      DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
      403,
      DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED,
    )
  })

  it('scoped-read 手写 owner 谓词 → 放行', async () => {
    const result = await attempt(machinePrincipal('agents:read', scopedReadCap), async () =>
      scoped
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, 'p-1'), eq(projects.userId, USER_ID))),
    )
    expectOk(result)
    expect(calls).toHaveLength(1)
  })

  it('scoped-read 经 scopedWhere() 生成条件 → 自动满足闸门(闭环)', async () => {
    const result = await attempt(machinePrincipal('agents:read', scopedReadCap), async () =>
      scoped
        .select({ id: projects.id })
        .from(projects)
        // 在请求上下文内取主体 → scopedWhere 自动绑定当前主体 ID
        .where(scopedWhere(scopedReadCap, { ownerColumn: projects.userId })),
    )
    expectOk(result)
    expect(calls[0]?.sql).toContain('"projects"."user_id"')
  })

  it('users 主键即 owner:scoped-read 读自己一行 → 放行', async () => {
    const result = await attempt(machinePrincipal('agents:read', scopedReadCap), async () =>
      scoped.select({ id: users.id }).from(users).where(eq(users.id, USER_ID)),
    )
    expectOk(result)
  })

  it('scoped-read 越权读他人项目 → OWNER_FILTER_REQUIRED', async () => {
    const result = await attempt(machinePrincipal('agents:read', scopedReadCap), async () =>
      scoped.select({ id: projects.id }).from(projects).where(eq(projects.userId, OTHER_ID)),
    )
    denied(
      result,
      DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
      403,
      DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED,
    )
  })

  it('业务表被机器凭据全表扫描(无 where)→ 拒绝', async () => {
    const result = await attempt(machinePrincipal('agents:read', scopedReadCap), async () =>
      scoped.select().from(projects),
    )
    denied(
      result,
      DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
      403,
      DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED,
    )
  })
})

// ============================================================================
// 4. 零回归
// ============================================================================
describe('O4-5 零回归论证', () => {
  it('无 principal 上下文(后台 worker / 定时器 / 未注册钩子)→ 闸门完全不参与', async () => {
    const result = await attempt(undefined, async () => scoped.select().from(users))
    expectOk(result)
    expect(calls).toHaveLength(1)
  })

  it('人用 JWT(即便带 compute 能力声明)→ 闸门不启动,存量过滤逻辑不变', async () => {
    const jwt: Principal = { ...humanPrincipal(0), capability: computeCap }
    const result = await attempt(jwt, async () => scoped.select().from(users))
    expectOk(result)
  })

  it('机器凭据但未挂 capability → 不启动(等价存量 /api/* 的 key 路由)', async () => {
    const result = await attempt(machinePrincipal('chat:write'), async () =>
      scoped.select().from(users),
    )
    expectOk(result)
  })

  it('db / dbRead(未包装出口)永不经过闸门 → 存量 700+ 调用点零改动', async () => {
    const fake = makeFakeClient()
    const plain = drizzle(fake.client, { schema })
    const result = await attempt(machinePrincipal('chat:write', computeCap), async () =>
      plain.select().from(users),
    )
    expectOk(result)
    expect(fake.calls).toHaveLength(1)
  })

  it('platform dataClass(unrestricted)→ 不加 owner 过滤也不拒(交由 M2M 闸拦机器凭据)', async () => {
    const result = await attempt(machinePrincipal('publish:operate', platformCap), async () =>
      scoped.select({ id: projects.id }).from(projects),
    )
    expectOk(result)
  })
})

// ============================================================================
// 5. scopedWhere 语义
// ============================================================================
describe('O4-6 scopedWhere', () => {
  it('platform / 无能力 → 不产出条件(unrestricted 由调用方自决)', () => {
    expect(scopedWhere(platformCap, { ownerColumn: projects.userId })).toBeUndefined()
    expect(scopedWhere(undefined, { ownerColumn: projects.userId })).toBeUndefined()
  })

  it('机器凭据强制 SELF:条件落在 owner 列且绑定主体 ID', () => {
    const built = runWithPrincipal(machinePrincipal('agents:read', scopedReadCap), () => {
      const condition = scopedWhere(scopedReadCap, { ownerColumn: projects.userId })
      return condition ? dialect.sqlToQuery(sql`${condition}`) : undefined
    })
    expect(built?.sql).toContain('"projects"."user_id"')
    expect(built?.params).toContain(USER_ID)
  })

  it('无主体上下文时默认拒绝(不产出"不过滤"的假安全)', () => {
    expect(() => scopedWhere(scopedReadCap, { ownerColumn: projects.userId })).toThrow(
      DataScopeViolationError,
    )
  })

  it('人用 JWT:管理员 → ALL 域不加过滤;普通用户 → 仅本人', () => {
    expect(
      scopedWhere(scopedReadCap, { ownerColumn: projects.userId, principal: humanPrincipal(1) }),
    ).toBeUndefined()
    const condition = scopedWhere(scopedReadCap, {
      ownerColumn: projects.userId,
      principal: humanPrincipal(3),
    })
    const built = condition ? dialect.sqlToQuery(sql`${condition}`) : undefined
    expect(built?.params).toContain(USER_ID)
  })

  it('附加条件 with and() 合并;FAMILY 无 familyColumn 时退化为仅本人', () => {
    const withExtra = scopedWhere(scopedReadCap, {
      ownerColumn: projects.userId,
      principal: humanPrincipal(3),
      and: eq(projects.status, 1),
    })
    const built = withExtra ? dialect.sqlToQuery(sql`${withExtra}`) : undefined
    expect(built?.sql).toContain('and')
    expect(built?.params).toContain(USER_ID)
    expect(built?.params).toContain(1)
  })
})

// ============================================================================
// 6. 请求链集成:principal 归一 + /v1 上下文 + 上下文在鉴权之后
// ============================================================================
describe('O4-7 请求链集成(Fastify)', () => {
  /** 借类型断言写凭据字段:避免为测试引入 plugins/auth.ts 的模块增广依赖。 */
  interface CredentialBag {
    apiKey?: AuthenticatedApiKey
    capability?: CapabilityEntry
    userId?: string
    jwtPayload?: { userId: string; roleId: number }
  }
  const bagOf = (request: FastifyRequest): CredentialBag => request as unknown as CredentialBag

  function apiKeyContext(permissions: ApiKeyPermission[]): AuthenticatedApiKey {
    return {
      id: API_KEY_ID,
      userId: USER_ID,
      key: 'ihui_x',
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

  /** 模拟 requireApiKeyAuth + requireCapability:在路由 preHandler 阶段注入凭据与能力。 */
  function authAsMachine(capability: CapabilityEntry, permissions: ApiKeyPermission[] = ['agents:read']) {
    return async (request: FastifyRequest): Promise<void> => {
      const bag = bagOf(request)
      bag.apiKey = apiKeyContext(permissions)
      bag.capability = capability
    }
  }

  function authAsHuman(roleId = 1) {
    return async (request: FastifyRequest): Promise<void> => {
      const bag = bagOf(request)
      bag.userId = USER_ID
      bag.jwtPayload = { userId: USER_ID, roleId }
    }
  }

  async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({ logger: false })
    // 与 server.ts 同一判据:AppError → statusCode + errorCode
    app.setErrorHandler((error, _request, reply) => {
      const statusCode = error.statusCode ?? 500
      void reply.status(statusCode).send({
        code: statusCode,
        message: error.message,
        ...(isAppError(error) ? { errorCode: error.errorCode } : {}),
      })
    })
    await app.register(principalPlugin)
    await app.register(rlsContextPlugin)

    app.get('/v1/whoami', { preHandler: [authAsMachine(scopedReadCap)] }, (request) => ({
      principal: request.principal,
    }))
    app.get('/api/human', { preHandler: [authAsHuman(1)] }, (request) => ({
      principal: request.principal,
    }))
    app.get('/api/public', (_request, reply) => reply.send({ ok: true }))
    app.get('/health', () => ({ status: 'ok' }))
    // 机器凭据在 handler 里读业务表 → 端到端 403
    app.get('/v1/leak', { preHandler: [authAsMachine(computeCap, ['chat:write'])] }, async () =>
      scoped.select().from(users),
    )
    // 机器凭据 scoped-read 带 owner → 端到端 200
    app.get(
      '/v1/mine',
      { preHandler: [authAsMachine(scopedReadCap)] },
      async () =>
        await scoped
          .select({ id: projects.id })
          .from(projects)
          .where(scopedWhere(scopedReadCap, { ownerColumn: projects.userId })),
    )
    await app.ready()
    return app
  }

  it('/v1 也设置上下文,且发生在鉴权之后(principal 惰性求值修掉旧 onRequest 恒空)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/v1/whoami' })
    expect(res.statusCode).toBe(200)
    expect(res.json().principal).toMatchObject({
      kind: 'apiKey',
      subjectId: USER_ID,
      apiKeyId: API_KEY_ID,
      roleId: 0,
      scopes: ['agents:read'],
    })
    expect(res.json().principal.capability).toMatchObject({ scope: 'agents:read' })

    expect(contextCapture.queries.length).toBeGreaterThan(0)
    const built = builtContextQuery(contextCapture.queries.length - 1)
    expect(built.sql).toContain('app.user_id')
    expect(built.sql).toContain('app.api_key_id')
    expect(built.sql).toContain('app.current_user_id')
    expect(built.sql).toContain('app.current_user_role')
    // 变量值来自鉴权后的真实主体(鉴权前这些字段全是 undefined)
    expect(built.params).toEqual([USER_ID, API_KEY_ID, USER_ID, '0'])
    await app.close()
  })

  it('同时带 JWT 与 API Key 时按 apiKey 计(取更严格一侧,不绕过机器侧闸门)', async () => {
    const app = Fastify({ logger: false })
    await app.register(principalPlugin)
    app.get('/v1/both', { preHandler: [authAsMachine(scopedReadCap), authAsHuman(1)] }, (request) => ({
      kind: request.principal?.kind,
      capability: request.principal?.capability?.scope,
    }))
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/v1/both' })
    expect(res.json().kind).toBe('apiKey')
    expect(res.json().capability).toBe('agents:read')
    await app.close()
  })

  it('JWT 链路 principal.kind=jwt,roleId 透传', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/human' })
    expect(res.statusCode).toBe(200)
    expect(res.json().principal).toMatchObject({ kind: 'jwt', subjectId: USER_ID, roleId: 1 })
    await app.close()
  })

  it('internal service token 链路 → kind=internal(第一方,闸门不启动)', async () => {
    const app = Fastify({ logger: false })
    await app.register(principalPlugin)
    app.get(
      '/api/internal',
      {
        preHandler: [
          async (request: FastifyRequest): Promise<void> => {
            bagOf(request).userId = USER_ID
          },
        ],
      },
      (request) => ({ kind: request.principal?.kind }),
    )
    await app.ready()
    const withHeader = await app.inject({
      method: 'GET',
      url: '/api/internal',
      headers: { 'x-internal-service-token': 'sekret' },
    })
    expect(withHeader.json().kind).toBe('internal')
    const withoutHeader = await app.inject({ method: 'GET', url: '/api/internal' })
    expect(withoutHeader.json().kind).toBe('jwt')
    await app.close()
  })

  it('存量公开路由:未鉴权 → 清空上下文(与旧版逐值一致),响应不变', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/public' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    const built = builtContextQuery(0)
    expect(built.params).toEqual(['', '', '', '0'])
    await app.close()
  })

  it('非 /api、/v1 前缀(/health、/docs)完全不碰上下文', async () => {
    expect(isScopedContextUrl('/health')).toBe(false)
    expect(isScopedContextUrl('/api/users')).toBe(true)
    expect(isScopedContextUrl('/v1/chat/completions')).toBe(true)
    expect(isScopedContextUrl('/api/x?y=1')).toBe(true)
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/health' })
    expect(contextCapture.queries).toHaveLength(0)
    await app.close()
  })

  it('端到端:compute 能力在 handler 里读业务表 → 403 DATA_ACCESS_DENIED', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/v1/leak' })
    expect(res.statusCode).toBe(403)
    expect(res.json().errorCode).toBe(DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED)
    expect(calls).toHaveLength(0)
    await app.close()
  })

  it('端到端:scoped-read 带 owner → 200(闸门不误伤合规查询)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/v1/mine' })
    expect(res.statusCode).toBe(200)
    expect(calls).toHaveLength(1)
    await app.close()
  })
})

// ============================================================================
// 7. 「超级用户 → RLS 不生效」显式断言
// ============================================================================
describe('O4-8 assertNonSuperuserForScopedMode(把免责声明变成 fail-closed 断言)', () => {
  it('确认超级用户 → scoped 能力 503 DATA_ISOLATION_UNAVAILABLE(不再区分环境)', async () => {
    configureDataScopeGuard({
      probeSuperuser: async () => true,
      isProduction: () => true,
    })
    const messages: string[] = []
    configureDataScopeGuard({ warn: (message) => messages.push(message) })
    await expect(assertNonSuperuserForScopedMode('read-owned')).rejects.toBeInstanceOf(
      DataScopeViolationError,
    )
    try {
      await assertNonSuperuserForScopedMode('write-owned')
    } catch (error) {
      const err = error as DataScopeViolationError
      expect(err.errorCode).toBe(DATA_SCOPE_ERROR_CODES.DATA_ISOLATION_UNAVAILABLE)
      expect(err.reason).toBe(DATA_SCOPE_ERROR_CODES.RLS_NOT_ENFORCED)
      // 隔离前提不成立 = 服务端问题 → 503,不得写成 403/500
      expect(err.statusCode).toBe(503)
    }
    // compute / platform 不受该断言约束(前者靠白名单,后者不涉机器数据)
    await expect(assertNonSuperuserForScopedMode('self-metadata')).resolves.toBeUndefined()
    await expect(assertNonSuperuserForScopedMode('unrestricted')).resolves.toBeUndefined()
  })

  it('非生产环境下"确认超级用户"同样拒绝(声明了隔离就必须给得出隔离)', async () => {
    configureDataScopeGuard({
      probeSuperuser: async () => true,
      isProduction: () => false,
    })
    await expect(assertNonSuperuserForScopedMode('read-owned')).rejects.toBeInstanceOf(
      DataScopeViolationError,
    )
  })

  it('无法证实(探针抛错)+ 生产 → 503 PROBE_FAILED;非生产 → 告警放行', async () => {
    configureDataScopeGuard({
      probeSuperuser: async () => {
        throw new Error('连接不可用')
      },
      isProduction: () => true,
    })
    try {
      await assertNonSuperuserForScopedMode('write-owned')
      throw new Error('预期生产环境 fail-closed 拒绝')
    } catch (error) {
      const err = error as DataScopeViolationError
      expect(err.errorCode).toBe(DATA_SCOPE_ERROR_CODES.DATA_ISOLATION_UNAVAILABLE)
      expect(err.reason).toBe('PROBE_FAILED')
      expect(err.statusCode).toBe(503)
    }

    const messages: string[] = []
    configureDataScopeGuard({
      isProduction: () => false,
      warn: (message) => messages.push(message),
    })
    await expect(assertNonSuperuserForScopedMode('write-owned')).resolves.toBeUndefined()
    expect(messages.join('|')).toContain('仅应用层数据闸在挡')
  })

  it('非超级用户 → 静默通过', async () => {
    configureDataScopeGuard({ probeSuperuser: async () => false, isProduction: () => true })
    await expect(assertNonSuperuserForScopedMode('read-owned')).resolves.toBeUndefined()
  })

  it('探测结果按 TTL 缓存:多次断言只探一次(不给每请求加往返)', async () => {
    let probes = 0
    configureDataScopeGuard({
      probeSuperuser: async () => {
        probes += 1
        return false
      },
      isProduction: () => true,
    })
    await assertNonSuperuserForScopedMode('read-owned')
    await assertNonSuperuserForScopedMode('read-owned')
    await assertNonSuperuserForScopedMode('write-owned')
    expect(probes).toBe(1)
  })

  it('探针只下发常量只读 SQL;形态异常归类为"探测不可用"而非"非超级用户"', async () => {
    const seen: string[] = []
    const probe = createSuperuserProbe(async (probeSql) => {
      seen.push(probeSql)
      return [{ is_superuser: 'off' }]
    })
    await expect(probe()).resolves.toBe(false)
    expect(seen).toEqual([SUPERUSER_PROBE_SQL])
    expect(SUPERUSER_PROBE_SQL).toBe("SELECT current_setting('is_superuser') AS is_superuser")
    // 只读:无分号多句、无 SET/DDL
    expect(/;|set\s|insert|update|delete|create|drop/i.test(SUPERUSER_PROBE_SQL)).toBe(false)

    const junk = createSuperuserProbe(async () => [{ is_superuser: 42 }])
    await expect(junk()).rejects.toBeInstanceOf(Error)
    const onTrue = createSuperuserProbe(async () => [{ is_superuser: 'on' }])
    await expect(onTrue()).resolves.toBe(true)
  })

  it('拦截层同步版:已证实超级用户时,scoped 查询在语句出口即 503(不依赖钩子)', async () => {
    configureDataScopeGuard({ probeSuperuser: async () => true, isProduction: () => true })
    // 先让异步断言把结论灌进缓存,模拟"钩子已探测过"
    await assertNonSuperuserForScopedMode('read-owned').catch(() => undefined)
    const result = await attempt(machinePrincipal('agents:read', scopedReadCap), async () =>
      scoped
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.userId, USER_ID)),
    )
    denied(
      result,
      DATA_SCOPE_ERROR_CODES.DATA_ISOLATION_UNAVAILABLE,
      503,
      DATA_SCOPE_ERROR_CODES.RLS_NOT_ENFORCED,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
