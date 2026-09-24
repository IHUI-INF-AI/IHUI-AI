// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据闸(Data Scope Gate)—— O4「对第三方 Agent 开放功能、但不开放数据」的机械层。
 *
 * 为什么必须是机械层:能力目录(packages/types/capability-catalog.ts)已经把
 * `dataClass` 登记齐全,但在本文件之前它只是**文档约定** —— 没有任何运行时组件
 * 消费它。`compute` 能力的调用方(第三方 Agent)拿到的是一个 API Key,而它一旦
 * 进入业务表就等价于"把全平台数据开放给了它"。这里把 dataClass 变成不可绕过的判据。
 *
 * 三层落点:
 *  1. `assertDbAccessAllowed(table, mode)` —— 纯判据(可单测,可被任意调用方复用)。
 *  2. `createScopedDb(db)` —— **真正可执行的拦截层**:代理 Drizzle 的 `session.prepareQuery`,
 *     使 `dbScoped()` 上 select / insert / update / delete / 关系查询(`db.query.*`)/
 *     `db.execute(sql)` / `transaction` 内语句**全部**先过判据再落库。
 *     机制选型理由见下方 createScopedDb 注释。
 *  3. `scopedWhere(capability, { ownerColumn })` —— 生成强制 owner 条件,
 *     路由侧复用即可自动满足判据 2 的 owner 谓词要求。
 *
 * 判定依据取两处(优先权威、兜底解析、取不到即拒):
 *  - Drizzle 在 `prepareQuery(query, fields, name, isArrayMode, mapper, **queryMetadata**)`
 *    第 6 参数传入 `{ type, tables }`(select/insert/update/delete 四构造器均传),
 *    表对象用 `getTableName`/`drizzle:OriginalName` 还原物理表名(别名不影响判定);
 *  - 关系查询(`db.query.*`)与裸 SQL(`db.execute(sql)`)不传 metadata →
 *    退化为编译产物 SQL 文本的表引用解析(`FROM/JOIN/INTO/UPDATE` + `"schema"."table"`);
 *  - 两处都拿不到表名 → **默认拒绝**(DATA_ACCESS_DENIED),绝不静默放行。
 *
 * 零回归:闸门只在 `currentPrincipalScope()` 存在、且 principal 同时满足
 * `capability 已注入` 与 `kind === 'apiKey'`(机器凭据)时启动。
 * 未挂 capability 的存量 `/api/*` 路由、人用 JWT 链路、后台 worker/定时器
 * (无 ALS 上下文)行为逐字节不变;`db`/`dbRead` 出口本身未被包装,只有
 * 新增的 `dbScoped()`/`dbReadScoped()` 走闸门。
 */
import { eq, getTableName, isTable, and, sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import {
  COMPUTE_ALLOWED_TABLES,
  DB_MODE_BY_DATA_CLASS,
  effectiveDataClass,
  type CapabilityEntry,
  type DbAccessMode,
} from '@ihui/types'
import { buildScopeFilter, DataScope, getDataScopeForRole } from '@ihui/auth'
import { AppError } from '../errors/AppError.js'
import { currentPrincipal, currentPrincipalScope, type Principal } from '../plugins/principal.js'

// ============================================================================
// 错误与错误码
// ============================================================================

/**
 * 数据闸错误码(响应体 errorCode 字段,客户端据此判定)。
 *
 * 三个对外契约码(与 O4 交付口径一致,不随内部措辞漂移):
 *  - `DATA_ACCESS_DENIED`         该 dataClass 根本不允许触达此表(或表名无法判定)
 *  - `DATA_SCOPE_DENIED`          模式允许触达,但本次语句越过归属边界(缺 owner 谓词 / 绑他人 ID)
 *  - `DATA_ISOLATION_UNAVAILABLE` 隔离前提不成立(连接为超级用户,或生产环境无法证实非超级用户)
 * 另保留两个历史码,只作为 `reason` 细分原因出现,不再作为 `errorCode` 下发。
 */
export const DATA_SCOPE_ERROR_CODES = {
  /** 该能力的 dataClass 不允许触达此表(或表名无法判定)。 */
  DATA_ACCESS_DENIED: 'DATA_ACCESS_DENIED',
  /** scoped-read / scoped-write 能力的语句越出归属边界(缺 owner 谓词或绑定了他人主体)。 */
  DATA_SCOPE_DENIED: 'DATA_SCOPE_DENIED',
  /** 行级隔离前提不成立 → 该能力本次不可用(fail-closed,503 而非 500)。 */
  DATA_ISOLATION_UNAVAILABLE: 'DATA_ISOLATION_UNAVAILABLE',
  /** @deprecated 细分原因;对外 errorCode 为 `DATA_SCOPE_DENIED`。 */
  OWNER_FILTER_REQUIRED: 'OWNER_FILTER_REQUIRED',
  /** @deprecated 细分原因;对外 errorCode 为 `DATA_ISOLATION_UNAVAILABLE`。 */
  RLS_NOT_ENFORCED: 'RLS_NOT_ENFORCED',
} as const

export type DataScopeErrorCode = (typeof DATA_SCOPE_ERROR_CODES)[keyof typeof DATA_SCOPE_ERROR_CODES]

/** 违规细分原因(排障与审计用;与对外 errorCode 分离,客户端只需认三个码)。 */
export type DataScopeDenyReason =
  | DataScopeErrorCode
  | 'PROBE_UNAVAILABLE'
  | 'PROBE_FAILED'

/**
 * 数据闸违规错误。继承 AppError → 全局 errorHandler 透传 statusCode + errorCode,
 * message 用中文(errorHandler 会把纯英文 message 改写成通用文案)。
 *
 * statusCode 语义分工(不得混用,尤其**不得把 503 写成 500**):
 *  - 403 = 调用方越权(换一枚有权限的凭据即可解决);
 *  - 503 = 服务端隔离前提不成立(换凭据也没用,必须运维切非超级用户角色 / 修探测链路)。
 */
export class DataScopeViolationError extends AppError {
  /** 触发判定的表名(裸 SQL / 无法判定时为 undefined)。 */
  readonly table: string | undefined
  /** 生效的 DB 访问模式。 */
  readonly mode: DbAccessMode
  /** 细分原因(OWNER_FILTER_REQUIRED / RLS_NOT_ENFORCED / PROBE_* 等)。 */
  readonly reason: DataScopeDenyReason | undefined

  constructor(
    errorCode: DataScopeErrorCode,
    message: string,
    mode: DbAccessMode,
    detail?: { table?: string; reason?: DataScopeDenyReason; statusCode?: number },
  ) {
    super(message, detail?.statusCode ?? 403, errorCode)
    this.name = 'DataScopeViolationError'
    this.table = detail?.table
    this.mode = mode
    this.reason = detail?.reason
  }
}

function dataAccessDenied(table: string | undefined, mode: DbAccessMode, why?: string): DataScopeViolationError {
  const subject = table ? `表 ${table}` : '无法判定目标表的语句(裸 SQL / CTE / 存储过程等)'
  return new DataScopeViolationError(
    DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED,
    `数据访问被拒绝:${why ?? `当前数据模式 ${mode} 不允许触达 ${subject}`}`,
    mode,
    { table },
  )
}

/**
 * 归属边界违规(403 `DATA_SCOPE_DENIED`)。
 * `reason` 沿用历史码 `OWNER_FILTER_REQUIRED`,使既有审计看板无需重新学习字段。
 */
function dataScopeDenied(
  table: string | undefined,
  mode: DbAccessMode,
  detail: { message: string; reason?: DataScopeDenyReason },
): DataScopeViolationError {
  return new DataScopeViolationError(
    DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED,
    `数据访问被拒绝:${detail.message}`,
    mode,
    { table, reason: detail.reason ?? DATA_SCOPE_ERROR_CODES.OWNER_FILTER_REQUIRED },
  )
}

function ownerFilterRequired(table: string | undefined, mode: DbAccessMode): DataScopeViolationError {
  return dataScopeDenied(table, mode, {
    message:
      `${mode} 模式下${table ? `表 ${table} 的` : ''}语句必须携带 owner 过滤条件` +
      `(请使用 scopedWhere() 生成 where 条件);无 owner 谓词的全表语句不允许由机器凭据发起`,
  })
}

/** 隔离前提不成立 → 503(能力对本次调用方暂不可用,与「越权」判然区别)。 */
function dataIsolationUnavailable(
  mode: DbAccessMode,
  reason: DataScopeDenyReason,
  why: string,
): DataScopeViolationError {
  return new DataScopeViolationError(
    DATA_SCOPE_ERROR_CODES.DATA_ISOLATION_UNAVAILABLE,
    `数据隔离不可用:${why}`,
    mode,
    { reason, statusCode: 503 },
  )
}

// ============================================================================
// 模式判定
// ============================================================================

/** SQL 语句类别(由编译产物文本推导;不采信 metadata.type —— drizzle 把 update 也标成 'insert')。 */
export const STATEMENT_KINDS = ['select', 'insert', 'update', 'delete', 'other'] as const
export type StatementKind = (typeof STATEMENT_KINDS)[number]

/** compute dataClass 下可触达的自有运行记录表(判据来自能力目录,单一事实源)。 */
const COMPUTE_ALLOWED_TABLE_SET: ReadonlySet<string> = new Set<string>(COMPUTE_ALLOWED_TABLES)

/** 该表是否属于 compute 白名单。 */
export function isComputeAllowedTable(table: string): boolean {
  return COMPUTE_ALLOWED_TABLE_SET.has(table)
}

/** scoped-* 模式(必须带 owner 谓词)。 */
function isScopedMode(mode: DbAccessMode): boolean {
  return mode === 'read-owned' || mode === 'write-owned'
}

/** dataClass → DB 访问模式(目录派生,不另立第二套映射)。 */
export function dbModeOfCapability(capability: CapabilityEntry | undefined): DbAccessMode {
  if (!capability) return 'unrestricted'
  return DB_MODE_BY_DATA_CLASS[effectiveDataClass(capability)]
}

export function dbModeForPrincipal(principal: Principal): DbAccessMode {
  return dbModeOfCapability(principal.capability)
}

/**
 * 是否需要启动数据闸:仅"机器凭据 + 已命中能力声明"。
 * 人用 JWT 与 internal 令牌属第一方代码路径(今天全库无 owner 过滤),
 * 一并纳入会在同一提交里打断存量业务,故不在闸门范围内 —— 它们的数据边界仍由
 * 各自的 authenticate + 业务层过滤负责(见主 agent 的 routes 接线清单)。
 */
export function isDataScopeEnforced(principal: Principal | undefined | null): principal is Principal {
  return !!principal && !!principal.capability && principal.kind === 'apiKey'
}

/** `assertDbAccessAllowed` 的补充判据入参。 */
export interface DbAccessAssertion {
  /**
   * 该语句是否已带 owner 谓词。
   * **默认 false**(缺省即拒绝):scoped-* 模式不会因为"调用方没说"而被放行。
   */
  ownerPredicateApplied?: boolean
  /** 语句类别(仅影响 owner 谓词形态;缺省按 select 处理) */
  kind?: StatementKind
}

/**
 * 判据核心(纯函数,可独立单测):
 * - `unrestricted`     → 放行(第一方代码 / platform dataClass)
 * - `forbidden`        → 一律 DATA_ACCESS_DENIED
 * - `self-metadata`    → compute:仅 COMPUTE_ALLOWED_TABLES 白名单,其余 DATA_ACCESS_DENIED;
 *                        表名不可判定 → 同样拒绝(默认拒绝)
 * - `read-owned` /
 *   `write-owned`      → 必须 ownerPredicateApplied,否则 OWNER_FILTER_REQUIRED;
 *                        表名不可判定 → DATA_ACCESS_DENIED
 */
export function assertDbAccessAllowed(
  table: string | null | undefined,
  mode: DbAccessMode,
  assertion: DbAccessAssertion = {},
): void {
  const ownerPredicateApplied = assertion.ownerPredicateApplied === true

  if (mode === 'unrestricted') return
  if (mode === 'forbidden') {
    throw dataAccessDenied(table ?? undefined, mode, '该能力的数据模式为 forbidden')
  }
  if (!table) {
    throw dataAccessDenied(undefined, mode, '无法判定目标表的语句一律拒绝(默认拒绝,不做静默放行)')
  }
  if (mode === 'self-metadata') {
    if (!isComputeAllowedTable(table)) {
      throw dataAccessDenied(table, mode, `compute 能力只可读写自有运行记录表,${table} 不在白名单`)
    }
    return
  }
  if (!ownerPredicateApplied) throw ownerFilterRequired(table, mode)
}

/** 多表语句的整体判据(拦截层调用;任一表不合规即拒)。 */
export function assertQueryAccessAllowed(input: {
  tables: readonly string[]
  mode: DbAccessMode
  kind: StatementKind
  ownerPredicateApplied: boolean
}): void {
  if (input.mode === 'unrestricted') return
  if (input.tables.length === 0) {
    throw dataAccessDenied(undefined, input.mode)
  }
  for (const table of input.tables) {
    assertDbAccessAllowed(table, input.mode, {
      ownerPredicateApplied: input.ownerPredicateApplied,
      kind: input.kind,
    })
  }
}

// ============================================================================
// owner 列映射
// ============================================================================

/** 未登记表的默认 owner 列(与库内绝大多数业务表一致)。 */
export const DEFAULT_OWNER_COLUMN = 'user_id'

/**
 * 表名 → owner 列名。仅登记"列名不叫 user_id"的例外,其余走默认值。
 * 可通过 configureDataScopeGuard({ ownerColumnByTable }) 追加(主 agent 接线时补全)。
 */
const OWNER_COLUMN_BY_TABLE: Record<string, string> = {
  // users 的"自有"即本人记录
  users: 'id',
  // files 的上传者列(见 idor-guard.ts)
  files: 'uploaded_by',
}

export function ownerColumnOf(table: string): string {
  return OWNER_COLUMN_BY_TABLE[table] ?? DEFAULT_OWNER_COLUMN
}

// ============================================================================
// 依赖注入(生产由 db/index.ts 注入探针;测试注入替身)
// ============================================================================

export interface DataScopeGuardDeps {
  /**
   * 探测当前连接角色是否超级用户(必须走原始 postgres 客户端,避免经被包装的 drizzle 出口递归)。
   * 用 `createSuperuserProbe()` 构造可保证「只读常量 SQL + 形态异常抛错」。
   * 未注入 → 结论为"无法证实":生产 503 fail-closed,非生产告警放行。
   */
  probeSuperuser?: () => Promise<boolean>
  /** 是否生产语义环境(缺省取 NODE_ENV === 'production') */
  isProduction?: () => boolean
  /** 告警通道(缺省 console.warn) */
  warn?: (message: string, fields?: Record<string, unknown>) => void
  /** 追加/覆盖 表名 → owner 列 映射 */
  ownerColumnByTable?: Readonly<Record<string, string>>
}

const deps: Required<Pick<DataScopeGuardDeps, 'isProduction' | 'warn'>> & Pick<
  DataScopeGuardDeps,
  'probeSuperuser'
> = {
  isProduction: () => process.env.NODE_ENV === 'production',
  warn: (message, fields) => {
    if (fields) console.warn(`[scoped-guard] ${message}`, fields)
    else console.warn(`[scoped-guard] ${message}`)
  },
}

/**
 * 注入运行期依赖(db/index.ts 启动时调用一次;测试各自注入替身)。
 *
 * 换探针 / 换环境判定时**必须作废已缓存的探测结论**:否则"启动时注入了 A 探针得到的
 * false"会永久掩盖"B 探针的真实结论",使 fail-closed 断言形同虚设(测试用例之间
 * 互相污染只是同一缺陷的显性表现)。
 */
export function configureDataScopeGuard(next: DataScopeGuardDeps): void {
  const invalidatesProbe = !!next.probeSuperuser || !!next.isProduction
  if (next.probeSuperuser) deps.probeSuperuser = next.probeSuperuser
  if (next.isProduction) deps.isProduction = next.isProduction
  if (next.warn) deps.warn = next.warn
  if (next.ownerColumnByTable) Object.assign(OWNER_COLUMN_BY_TABLE, next.ownerColumnByTable)
  if (invalidatesProbe) resetSuperuserCache()
}

export function isProductionDataScope(): boolean {
  return deps.isProduction()
}

// ============================================================================
// 「超级用户连接 → RLS 不生效」的显式断言
// ============================================================================

/**
 * 超级用户探针的**唯一**语句:常量、无参数、纯 `SELECT`(无写、无 SET、无 DDL),
 * 因此"探针只读"是类型 + 运行时双重可证明的性质,而不是注释里的口头承诺。
 * 导出以便测试直接断言实际下发的 SQL 文本。
 */
export const SUPERUSER_PROBE_SQL = "SELECT current_setting('is_superuser') AS is_superuser" as const

/** 探针执行器:只接受上面那条常量 SQL,永不接受拼接(避免探针本身成为注入面)。 */
export type SuperuserProbeRunner = (sqlText: typeof SUPERUSER_PROBE_SQL) => Promise<readonly unknown[]>

/**
 * 构造生产探针(db/index.ts 注入)。返回 true=超级用户 / false=普通角色;
 * 形态异常一律抛错(由 probeIsSuperuser 归类为"探测不可用",而不是当作"非超级用户")。
 */
export function createSuperuserProbe(run: SuperuserProbeRunner): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    const rows = await run(SUPERUSER_PROBE_SQL)
    const first: unknown = rows[0]
    const flag = isRecord(first) ? first['is_superuser'] : undefined
    if (typeof flag === 'boolean') return flag
    if (typeof flag === 'string') {
      const normalized = flag.trim().toLowerCase()
      if (['on', 'true', 'yes', 'y', '1'].includes(normalized)) return true
      if (['off', 'false', 'no', 'n', '0'].includes(normalized)) return false
    }
    throw new Error('is_superuser 探测返回形态异常(既非布尔也非 on/off)')
  }
}

const SUPERUSER_CACHE_TTL_MS = 10 * 60_000
/** 探测不可用的结论缓存更短:不能因一次抖动长期把 scoped 能力锁死,也不能每请求重试打库。 */
const PROBE_UNAVAILABLE_CACHE_TTL_MS = 30_000
let superuserCache: { value: boolean | undefined; at: number } | undefined
let superuserInFlight: Promise<boolean | undefined> | undefined
let superuserWarnedOnce = false
let probeUnavailableReason: DataScopeDenyReason | undefined

function cachedProbeConclusion(): { value: boolean | undefined; at: number } | undefined {
  if (!superuserCache) return undefined
  const ttl = superuserCache.value === undefined ? PROBE_UNAVAILABLE_CACHE_TTL_MS : SUPERUSER_CACHE_TTL_MS
  if (Date.now() - superuserCache.at > ttl) return undefined
  return superuserCache
}

/** 同步读取已缓存的探测结论(未探测/已过期 → undefined)。 */
export function cachedSuperuserFlag(): boolean | undefined {
  return cachedProbeConclusion()?.value
}

/** 最近一次"探测不可用"的归类原因(供 503 文案与审计区分"没探针"和"探针炸了")。 */
export function lastProbeUnavailableReason(): DataScopeDenyReason | undefined {
  return probeUnavailableReason
}

/**
 * 异步探测(带 TTL 缓存 + 并发合流);无探针或探测失败返回 undefined。
 *
 * "结果缓存"是硬要求:10 分钟内所有请求复用同一次探测,**不给每个请求加一次往返**;
 * 并发请求合流到同一个 in-flight promise,不会因并发而重复打库。
 */
export async function probeIsSuperuser(): Promise<boolean | undefined> {
  const cached = cachedProbeConclusion()
  if (cached) return cached.value
  if (superuserInFlight) return superuserInFlight
  const probe = deps.probeSuperuser
  if (!probe) {
    probeUnavailableReason = 'PROBE_UNAVAILABLE'
    if (!superuserWarnedOnce) {
      superuserWarnedOnce = true
      deps.warn('未注入 probeSuperuser 探针,无法验证连接角色(若以超级用户连接,数据库层 RLS 形同虚设)')
    }
    superuserCache = { value: undefined, at: Date.now() }
    return undefined
  }
  superuserInFlight = (async (): Promise<boolean | undefined> => {
    try {
      const value = await probe()
      superuserCache = { value, at: Date.now() }
      return value
    } catch (error) {
      probeUnavailableReason = 'PROBE_FAILED'
      superuserCache = { value: undefined, at: Date.now() }
      deps.warn('超级用户探测失败', { error: String(error) })
      return undefined
    } finally {
      superuserInFlight = undefined
    }
  })()
  return superuserInFlight
}

/** 测试/热重载用:清空探测缓存(下一次断言会重新探测)。 */
export function resetSuperuserCache(): void {
  superuserCache = undefined
  superuserInFlight = undefined
  superuserWarnedOnce = false
  probeUnavailableReason = undefined
}

/**
 * 「以超级用户连接 ⇒ RLS 不生效」从注释里的免责声明变成运行期断言(fail-closed)。
 *
 * 背景(已核实):rls-context 写的是 session 变量,而应用连的是 postgres 超级用户;
 * 超级用户**绕过一切 RLS 策略**,所以"设置了 app.current_user_id"不等于"数据被行级隔离"。
 * 于是 scoped 能力(read-owned / write-owned)在数据库层没有任何兜底,只有应用层数据闸。
 *
 * 判据(三态,全部可测):
 *  - 确认超级用户         → **503 DATA_ISOLATION_UNAVAILABLE**(不再区分环境:
 *                          声明"行级隔离"却给不出隔离,是能力不可用,不是越权,也不是配置警告)
 *  - 无法证实非超级用户    → 生产 503(fail-closed);非生产仅告警放行(开发/测试不被探针绑架)
 *  - 确认普通角色         → 静默通过
 * 探测结果进程内缓存,不会给每个请求增加一次往返。
 */
export async function assertNonSuperuserForScopedMode(mode: DbAccessMode): Promise<void> {
  if (!isScopedMode(mode)) return
  const superuser = await probeIsSuperuser()
  if (superuser === false) return
  if (superuser === undefined) {
    if (!deps.isProduction()) {
      deps.warn(`无法证实数据库连接角色非超级用户;当前为 ${mode} 模式,仅应用层数据闸在挡`, { mode })
      return
    }
    throw dataIsolationUnavailable(
      mode,
      probeUnavailableReason ?? 'PROBE_UNAVAILABLE',
      `生产环境无法证实数据库连接角色不是超级用户(${probeUnavailableReason ?? 'PROBE_UNAVAILABLE'})` +
        ',无法保证行级安全(RLS),scoped 能力暂不可用',
    )
  }
  throw dataIsolationUnavailable(
    mode,
    DATA_SCOPE_ERROR_CODES.RLS_NOT_ENFORCED,
    `数据库以超级用户连接,行级安全(RLS)不生效,${mode} 能力不可用` +
      '(请为应用切换到非超级用户角色并启用 RLS 策略)',
  )
}

/**
 * 拦截层同步版:只读已缓存结论,**不触发新的探测查询**(闸门在 prepareQuery 热路径上)。
 * fail-closed 与异步版一致:确认超级用户即 503;生产环境下"已证实探测不可用"同样 503。
 */
function assertNonSuperuserForScopedModeSync(mode: DbAccessMode): void {
  if (!isScopedMode(mode)) return
  const conclusion = cachedProbeConclusion()
  if (!conclusion) return
  if (conclusion.value === true) {
    throw dataIsolationUnavailable(
      mode,
      DATA_SCOPE_ERROR_CODES.RLS_NOT_ENFORCED,
      `数据库以超级用户连接,RLS 不生效,${mode} 能力不可用`,
    )
  }
  if (conclusion.value === undefined && deps.isProduction()) {
    throw dataIsolationUnavailable(
      mode,
      probeUnavailableReason ?? 'PROBE_UNAVAILABLE',
      `生产环境无法证实连接角色非超级用户,${mode} 能力不可用`,
    )
  }
}

// ============================================================================
// 表名 / 语句类型解析
// ============================================================================

/** drizzle 私有符号(全局注册符号,跨模块稳定):别名表的物理名保存在 OriginalName。 */
const DRIZZLE_ORIGINAL_NAME: symbol = Symbol.for('drizzle:OriginalName')

/** 从 drizzle 表对象取物理表名(别名 `users.as('u')` 也还原为 users)。 */
export function tableNameFromTableObject(candidate: unknown): string | undefined {
  if (!isTable(candidate)) return undefined
  const original = (candidate as unknown as Record<symbol, unknown>)[DRIZZLE_ORIGINAL_NAME]
  if (typeof original === 'string' && original.length > 0) return original
  return getTableName(candidate as Parameters<typeof getTableName>[0])
}

function uniqueNames(names: readonly (string | undefined)[]): string[] {
  const out = new Set<string>()
  for (const n of names) if (typeof n === 'string' && n) out.add(n)
  return [...out]
}

/** metadata.tables(extractUsedTable 产物)→ 物理表名;结构异常返回空数组。 */
export function resolveTableNamesFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const tables = (metadata as { tables?: unknown }).tables
  if (!Array.isArray(tables)) return []
  return uniqueNames(
    tables.map((entry) =>
      // drizzle 的 pg-core 编译器把表名**以字符串形态**下发(如 'llm_call_logs' / 'public.users'),
      // 只认表对象会让这条路径恒返回 [] ⇒ 数据面网关按"未知表"缺省拒绝合法请求。
      typeof entry === 'string'
        ? (entry.split('.').pop() ?? '').trim().toLowerCase()
        : tableNameFromTableObject(entry),
    ),
  )
}

/** FROM/JOIN/INTO/UPDATE 后的标识符(schema 限定取表名段)。 */
const SQL_TABLE_REF_RE =
  /\b(?:from|join|into|update)\s+(?:"?([a-z_][a-z0-9_$]*)"?\.)?"?([a-z_][a-z0-9_$]*)"?/gi

/** 编译产物 SQL 文本兜底解析表名(裸 SQL / 关系查询无 metadata 时使用)。 */
export function resolveTableNamesFromSql(sqlText: string): string[] {
  const names: string[] = []
  SQL_TABLE_REF_RE.lastIndex = 0
  for (let m = SQL_TABLE_REF_RE.exec(sqlText); m; m = SQL_TABLE_REF_RE.exec(sqlText)) {
    const table = m[2]
    if (!table) continue
    const end = (m.index ?? 0) + m[0].length
    // `from unnest(...)` / `from generate_series(...)` 等表函数不是数据表
    if (sqlText.slice(end, end + 1) === '(') continue
    names.push(table.toLowerCase())
  }
  return uniqueNames(names)
}

/** 表名解析:metadata 权威优先,SQL 文本兜底。 */
export function resolveQueryTableNames(metadata: unknown, sqlText: string): string[] {
  const fromMetadata = resolveTableNamesFromMetadata(metadata)
  if (fromMetadata.length > 0) return fromMetadata
  return resolveTableNamesFromSql(sqlText)
}

/** 语句类型(按首个关键字);with/调用等无法归类 → 'other'(scoped 模式必拒)。 */
export function statementKindOf(sqlText: string): StatementKind {
  const head = sqlText.trimStart().slice(0, 12).toLowerCase()
  if (head.startsWith('select') || head.startsWith('(select')) return 'select'
  if (head.startsWith('insert')) return 'insert'
  if (head.startsWith('update')) return 'update'
  if (head.startsWith('delete')) return 'delete'
  return 'other'
}

/** 语句是否把主体 ID 绑定为参数(owner 过滤必须绑定到"自己",不能是常量/他人 ID)。 */
function bindsSubject(params: readonly unknown[], subjectId: string): boolean {
  return params.some((p) => typeof p === 'string' && p === subjectId)
}

/** 语句文本是否引用了该表的 owner 列。 */
function referencesOwnerColumn(sqlText: string, table: string): boolean {
  const column = ownerColumnOf(table)
  if (!sqlText.includes(`"${column}"`)) return false
  // users 的 owner 列是主键 "id",裸 "id" 到处出现 → 必须是被限定引用的形式
  if (column === 'id') return /"[a-z_][a-z0-9$]*"\."id"/i.test(sqlText)
  return true
}

export interface OwnerPredicateEvidence {
  tables: readonly string[]
  kind: StatementKind
  sqlText: string
  params: readonly unknown[]
  subjectId: string
}

/**
 * owner 谓词证据判定(证据式,非信任式):
 * - select/update/delete:必须有 WHERE、引用每张被访问表的 owner 列、并把主体 ID 绑定为参数;
 * - insert:列清单必须含 owner 列,且主体 ID 作为参数写入(机器凭据只能种自己的数据);
 * - 其他语句类型 / 无表名 / 多表但未全覆盖 → false。
 */
export function hasOwnerPredicate(evidence: OwnerPredicateEvidence): boolean {
  const { tables, kind, sqlText, params, subjectId } = evidence
  if (tables.length === 0) return false
  if (kind === 'other') return false
  if (!bindsSubject(params, subjectId)) return false
  if (kind !== 'insert' && !/\bwhere\b/i.test(sqlText)) return false
  return tables.every((table) => referencesOwnerColumn(sqlText, table))
}

// ============================================================================
// 拦截层核心:prepareQuery 判据
// ============================================================================

/** drizzle `session.prepareQuery` 的编译产物形态。 */
interface BuiltQuery {
  sql: string
  params: unknown[]
}

function isBuiltQuery(candidate: unknown): candidate is BuiltQuery {
  if (!candidate || typeof candidate !== 'object') return false
  const rec = candidate as { sql?: unknown; params?: unknown }
  return typeof rec.sql === 'string' && Array.isArray(rec.params)
}

/**
 * 对一次 `session.prepareQuery(...)` 调用执行数据闸。
 * 位置参数索引:`[query, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig]`
 * —— 第 6 位是 drizzle 自带的 `{type, tables}` 元数据(关系查询/裸 SQL 不传)。
 */
export function enforceDbAccessForPreparedQuery(args: readonly unknown[]): void {
  if (!currentPrincipalScope()) return
  const principal = currentPrincipal()
  if (!isDataScopeEnforced(principal)) return

  const mode = dbModeForPrincipal(principal)
  assertNonSuperuserForScopedModeSync(mode)

  const built = args[0]
  if (!isBuiltQuery(built)) {
    // 编译产物形态异常 → 无法判定表名 → 默认拒绝
    throw dataAccessDenied(undefined, mode)
  }
  const tables = resolveQueryTableNames(args[5], built.sql)
  const kind = statementKindOf(built.sql)
  const ownerPredicateApplied = hasOwnerPredicate({
    tables,
    kind,
    sqlText: built.sql,
    params: built.params,
    subjectId: principal.subjectId,
  })
  assertQueryAccessAllowed({ tables, mode, kind, ownerPredicateApplied })
}

// ============================================================================
// createScopedDb —— 最小侵入的 Drizzle 出口代理
// ============================================================================

type AnyFunction = (...args: unknown[]) => unknown

interface DbInternals {
  session?: unknown
  query?: unknown
}

function isRecord(candidate: unknown): candidate is Record<PropertyKey, unknown> {
  return typeof candidate === 'object' && candidate !== null
}

/** 原始 session → 受控 session(同一实例只包一次)。 */
const guardedSessions = new WeakMap<object, object>()
const guardedQueryMaps = new WeakMap<object, object>()
const guardedRelationalBuilders = new WeakMap<object, object>()

function guardSession(rawSession: unknown): unknown {
  if (!isRecord(rawSession)) return rawSession
  const cached = guardedSessions.get(rawSession)
  if (cached) return cached

  const guarded = new Proxy(rawSession, {
    get(target, prop) {
      if (prop === 'prepareQuery') {
        const original = target.prepareQuery
        if (typeof original !== 'function') return original
        const fn = original as AnyFunction
        return function guardedPrepareQuery(...args: unknown[]): unknown {
          enforceDbAccessForPreparedQuery(args)
          return fn.apply(target, args)
        }
      }
      // 事务内的语句走新 session(client.begin 派生),这里把回调入参换成受控 db
      if (prop === 'transaction') {
        const original = target.transaction
        if (typeof original !== 'function') return original
        const fn = original as AnyFunction
        return function guardedTransaction(callback: unknown, config?: unknown): unknown {
          if (typeof callback !== 'function') return fn.call(target, callback, config)
          const cb = callback as AnyFunction
          return fn.call(target, (tx: unknown) => cb(createScopedDb(tx as object)), config)
        }
      }
      return Reflect.get(target, prop, target)
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value)
    },
  })
  guardedSessions.set(rawSession, guarded)
  return guarded
}

/**
 * `db.query.*` 的关系查询构造器在 **db 实例化时**就捕获了原始 session
 * (PgDatabase 构造函数直接传 session),所以必须逐个换成受控 session,
 * 否则 `dbScoped().query.users.findMany()` 会绕过闸门 = 静默放行。
 * 构造器字段都是自有可枚举属性,克隆 + 覆盖 session 即可。
 */
function guardQueryMap(rawQuery: unknown, guardedSession: unknown): unknown {
  if (!isRecord(rawQuery)) return rawQuery
  const cached = guardedQueryMaps.get(rawQuery)
  if (cached) return cached

  const guarded = new Proxy(rawQuery, {
    get(target, prop) {
      const builder = Reflect.get(target, prop, target)
      if (!isRecord(builder)) return builder
      if (typeof builder.session === 'undefined') return builder
      const swap = guardedRelationalBuilders.get(builder)
      if (swap) return swap
      const proto: object | null = Object.getPrototypeOf(builder) as object | null
      const cloned = Object.assign(Object.create(proto ?? null), builder, { session: guardedSession })
      guardedRelationalBuilders.set(builder, cloned)
      return cloned
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value)
    },
  })
  guardedQueryMaps.set(rawQuery, guarded)
  return guarded
}

/**
 * 把任意 drizzle 出口包成受控客户端 `dbScoped()`。
 *
 * 机制:Proxy 只改写两处属性读取 —— `session`(拦 prepareQuery,覆盖
 * select/insert/update/delete/execute/$count)与 `query`(换掉关系查询构造器的
 * session)。其余方法一律**不 bind** 返回,使 `this` 保持为代理本身,
 * 于是 `db.select()` 内部读的 `this.session` 必然命中受控会话。
 * 这样无需触碰任何一条业务 SQL,也无需路由配合即获得"出口级"覆盖。
 *
 * `resolve` 版本用于 `dbRead`(其自身是动态读副本代理,每次属性访问才选副本),
 * 保证受控客户端每次解析都跟上当前的健康副本。
 */
export function createScopedDb<TDb extends object>(dbOrValue: TDb | (() => TDb)): TDb {
  const resolve = (): TDb =>
    typeof dbOrValue === 'function' ? (dbOrValue as () => TDb)() : dbOrValue

  const handler: ProxyHandler<TDb> = {
    get(_target, prop) {
      const raw = resolve() as unknown as DbInternals & object
      if (prop === 'session') return guardSession(raw.session)
      if (prop === 'query') return guardQueryMap(raw.query, guardSession(raw.session))
      return Reflect.get(raw, prop, raw)
    },
    set(_target, prop, value) {
      const raw = resolve() as unknown as object
      return Reflect.set(raw, prop, value)
    },
    has(_target, prop) {
      return Reflect.has(resolve() as unknown as object, prop)
    },
    getPrototypeOf() {
      return Object.getPrototypeOf(resolve() as unknown as object)
    },
    ownKeys() {
      return Reflect.ownKeys(resolve() as unknown as object)
    },
    getOwnPropertyDescriptor(_target, prop) {
      const raw = resolve() as unknown as object
      const descriptor = Reflect.getOwnPropertyDescriptor(raw, prop)
      // 代理目标是无原生的空对象,必须把转发来的描述符标成可配置以满足不变量
      return descriptor ? { ...descriptor, configurable: true } : undefined
    },
  }
  return new Proxy(Object.create(null) as TDb, handler)
}

// ============================================================================
// scopedWhere —— 强制 owner 条件生成器(路由复用)
// ============================================================================

export interface ScopedWhereOptions {
  /** 该表的 owner 列(如 projects.userId / files.uploadedBy / users.id) */
  ownerColumn: PgColumn
  /** 主体覆盖:省略时取当前请求上下文 */
  principal?: Principal
  /** 家庭共享列(FAMILY 域需要;未提供时 FAMILY 退化为"仅本人") */
  familyColumn?: PgColumn
  /** 当前主体所属 family(有则走 family 过滤) */
  familyId?: string
  /** 附加条件(与 owner 条件 AND 合并) */
  and?: SQL<unknown>
}

/**
 * 基于 packages/auth 的 6 级 DataScope 生成**强制** owner 条件。
 *
 * - 能力为 platform(unrestricted)→ 返回 undefined(由调用方自行决定 where);
 * - 机器凭据一律按 SELF(不给任何提权空间);
 * - DataScope.NONE → `sql\`false\``(零可见,而不是"不过滤");
 * - 拿不到主体 → 抛 OWNER_FILTER_REQUIRED(默认拒绝)。
 *
 * 返回的条件用于 `dbScoped().select().from(t).where(scopedWhere(...))`,
 * 其中 owner 列会被拦截层识别为"已带 owner 谓词"。
 */
export function scopedWhere(
  capability: CapabilityEntry | undefined,
  options: ScopedWhereOptions,
): SQL<unknown> | undefined {
  const mode = dbModeOfCapability(capability)
  if (mode === 'unrestricted') return undefined

  const principal = options.principal ?? currentPrincipal()
  if (!principal?.subjectId) {
    throw ownerFilterRequired(undefined, mode)
  }

  const scope = principal.kind === 'apiKey' ? DataScope.SELF : getDataScopeForRole(principal.roleId)
  const filter = buildScopeFilter(scope, principal.subjectId, options.familyId)
  const owner = options.ownerColumn

  let condition: SQL<unknown> | undefined
  switch (filter.scope) {
    case DataScope.ALL:
      return options.and
    case DataScope.NONE:
      condition = sql`false`
      break
    case DataScope.FAMILY:
      condition =
        options.familyColumn && filter.familyId
          ? eq(options.familyColumn, filter.familyId)
          : eq(owner, principal.subjectId)
      break
    default:
      condition = eq(owner, filter.userId ?? principal.subjectId)
      break
  }
  return options.and ? and(condition, options.and) : condition
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
