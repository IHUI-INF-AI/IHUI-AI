// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 请求上下文中间件(原「RLS 上下文」)—— O4 修正后的形态。
 *
 * 修掉的三个既有缺陷(均已核实,不是猜测):
 *  1. **时机错**:旧版在 `onRequest` 读 `request.userId`,而鉴权发生在 `preHandler`
 *     → 变量恒为空,等于什么都没设。现改为用 `onRoute` 把钩子**追加到路由自身
 *     preHandler 数组末尾**(auth → capability → 本钩子 → handler),顺序由 Fastify
 *     组合规则保证,不再依赖"谁先注册"。
 *  2. **覆盖面错**:旧版只对 `url.startsWith('/api/')` 生效,对外开放的 `/v1/*`
 *     连上下文都不设。现 `/api/*` 与 `/v1/*` 同等生效。
 *  3. **认知错**:旧版注释自述"当前以 postgres 超级用户连接,RLS 默认不生效",
 *     但只把它当免责声明。现把它变成**显式断言**:scoped 能力(read-owned /
 *     write-owned)一旦确认连接角色是超级用户(或无法证实非超级用户)→ 直接 503
 *     DATA_ISOLATION_UNAVAILABLE + 告警(fail-closed,见 scoped-guard.assertNonSuperuserForScopedMode)。
 *     多租户 RLS 早被 packages/database/drizzle/0214_cleanup_legacy_tenant_rls.sql
 *     判定为"功能性死代码"并删列删策略,所以**当前真正在挡数据的是应用层数据闸**
 *     (utils/scoped-guard.ts),这里设的会话变量只有在切换到非超级用户角色 +
 *     重建策略后才会参与拦截。
 *
 * 写入的会话变量(单次 set_config 往返,不逐条发 SQL):
 *   app.user_id / app.api_key_id            —— 新契约(O4)
 *   app.current_user_id / app.current_user_role —— 旧名,保留以兼容历史策略函数
 *
 * **请求结束必须复位(F-02,2026-11-05)**:上面四个名字都用 `set_config(..., false)`
 * 写,作用域是**整条物理连接**而不是本次请求;连接池复用下,请求 A 结束后这条连接
 * 会被请求 B 借走 —— 若不复位,B 的查询会带着 A 的 `app.user_id`,而历史策略里
 * `app.current_user_role = '1'` 那一支是**放宽**方向(残值把表开放给下一个人)。
 * 因此本插件在 `onResponse` / `onError` / `onRequestAbort` 三条出口上把四个变量
 * 清成空串(同一个 set_config 语句、同一往返形态);未写过非空主体的请求不触发,
 * 不给未鉴权流量加往返。`withRlsContext` 的 finally 也走同一个出口。
 *
 * 为什么不用事务级 `set_config(..., true)`(即 `SET LOCAL`):请求生命周期**不在**
 * 一个事务里(handler 各自用 `db` / `dbRead`,流式路由还会长时间持响应),事务外的
 * `SET LOCAL` 是一条**无效**语句(只发 warning 不生效)—— `tenant-db-isolation.ts`
 * 就踩过这个坑。要做到事务级语义,得把整条请求链路塞进一个事务并按请求路由连接,
 * 那是连接池语义改造,不在本次修复范围。
 *
 * 本修复的**边界(如实登记)**:它闭合的是「池化连接串行复用」——
 * A 结束后同一条连接上 B 拿到的是 B、role 残值被清掉(有真库同池用例)。
 * 并发场景下两个请求的交错仍可能让后写的上下文盖掉前一个(会话变量本征限制),
 * 彻底解法是「每请求固定一条连接」或「每查询/每事务 SET LOCAL」,两者都需要改
 * 连接获取语义;详见交付报告的方案 A/B 与风险评估,不要在没做那一步之前宣称
 * 并发隔离已成立。另:上下文只写在主池(`db`),读副本池未覆盖(见迁移头注 1b)。
 *
 * 零回归:仍只对 `/api/*` 前缀做与旧版等价的 set/clear 行为(`/v1/*` 是本次按需求
 * 新增覆盖);未鉴权请求走 clear 分支,与旧版一致。断言仅在 capability+apiKey
 * 双条件成立时才可能抛错,存量人用链路不受影响。
 */
import type { FastifyPluginAsync, FastifyRequest, RouteOptions } from 'fastify'
import fp from 'fastify-plugin'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  assertNonSuperuserForScopedMode,
  dbModeForPrincipal,
  isDataScopeEnforced,
} from '../utils/scoped-guard.js'

/** 需要设上下文的对外前缀:`/api/*`(人 + 内部)+ `/v1/*`(OpenAI 兼容对外协议面)。 */
const SCOPED_URL_PREFIXES = ['/api/', '/v1/'] as const

export function isScopedContextUrl(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0] ?? ''
  return SCOPED_URL_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/** 组装一次 set_config 的四个值(空串 = 显式清空,零信任)。 */
function contextValuesOf(request: FastifyRequest): {
  userId: string
  roleId: string
  apiKeyId: string
} {
  const principal = request.principal
  if (principal) {
    return {
      userId: principal.subjectId,
      roleId: String(principal.roleId),
      apiKeyId: principal.apiKeyId ?? '',
    }
  }
  // 兜底:未走 principal 链路(例如内部脚本直接复用钩子)时读原始字段,行为与旧版一致
  return {
    userId: request.userId ?? '',
    roleId: String(request.jwtPayload?.roleId ?? 0),
    apiKeyId: request.apiKey?.id ?? '',
  }
}

/** 会话上下文语句的出口类型:默认主池;测试/脚本可注入只演一条连接的执行器。 */
type ContextExecutor = Pick<typeof db, 'execute'>

/**
 * 写入四个会话变量(默认主池)。
 *
 * 导出是为了让真库测试能用「max=1 的独立池」直接验证同连接语义(不必绕 Fastify),
 * 业务代码请走 `applyRequestContext` / `withRlsContext`,不要直接调本函数。
 */
export async function applyRequestContextValues(
  values: {
    userId: string
    roleId: string
    apiKeyId: string
  },
  executor: ContextExecutor = db,
): Promise<void> {
  try {
    await executor.execute(
      sql`SELECT set_config('app.user_id', ${values.userId}, false),
                 set_config('app.api_key_id', ${values.apiKeyId}, false),
                 set_config('app.current_user_id', ${values.userId}, false),
                 set_config('app.current_user_role', ${values.roleId}, false)`,
    )
  } catch (error) {
    // 上下文写入失败不影响主链路(与旧版一致),但必须留痕:此时数据库层没有任何隔离
    console.error('[request-context] set context failed:', (error as Error).message)
  }
}

/**
 * 请求结束复位(F-02):把四个会话变量逐项清成空串。
 *
 * 与写入用**同一条** set_config 语句形态 —— 清空也是"一次往返、四个变量",不是四次
 * set_config(避免把复位做成比写入更贵、被人顺手删掉的东西)。空串是零信任值:
 * `''` 不等于任何 uuid / 角色号,策略的归属谓词整段为 false ⇒ fail-closed。
 *
 * 导出给 `withRlsContext` 与测试复用;插件在 onResponse/onError/onRequestAbort 上调用。
 */
export async function releaseRequestContext(executor: ContextExecutor = db): Promise<void> {
  await applyRequestContextValues({ userId: '', roleId: '', apiKeyId: '' }, executor)
}

/** 本请求写过非空主体 ⇒ 出口必须复位。WeakSet 不持有 request,无泄漏。 */
const requestsWithContext = new WeakSet<FastifyRequest>()

/** 幂等复位:同一个 request 可能同时命中 onError 与 onResponse,只清一次。 */
async function releaseOnce(request: FastifyRequest): Promise<void> {
  if (!requestsWithContext.has(request)) return
  // 先摘标记再发语句:即使这条复位语句本身失败,也不会在同一请求上重复打库
  requestsWithContext.delete(request)
  await releaseRequestContext()
}

/**
 * 每请求一次:① 写会话变量;② 对 scoped 机器能力执行"非超级用户"断言。
 * 抛出的 DataScopeViolationError(403)由全局 errorHandler 渲染。
 */
export async function applyRequestContext(request: FastifyRequest): Promise<void> {
  if (!isScopedContextUrl(request.url)) return
  const values = contextValuesOf(request)
  await applyRequestContextValues(values)
  // 只有写过非空主体才需要在出口复位:未鉴权请求写的是空值,本身就是干净状态
  if (values.userId !== '' || values.apiKeyId !== '' || values.roleId !== '0') {
    requestsWithContext.add(request)
  }

  const principal = request.principal
  if (!isDataScopeEnforced(principal)) return
  // 探测结果进程内缓存(10 分钟),不会给每个请求增加一次往返
  await assertNonSuperuserForScopedMode(dbModeForPrincipal(principal))
}

const requestContextPlugin: FastifyPluginAsync = async (server) => {
  // F-02:三条出口都复位 —— 正常收尾(onResponse)、handler 抛错(onError)、
  // 客户端提前断开(onRequestAbort,不保证还会走 onResponse)。
  // 钩子挂在实例上(不是逐路由),靠 requestsWithContext 判"本次请求到底写没写过主体",
  // 所以 404 / 未鉴权 / 非 scoped 前缀的流量零额外往返。
  server.addHook('onResponse', async (request: FastifyRequest) => {
    await releaseOnce(request)
  })
  server.addHook('onError', async (request: FastifyRequest) => {
    await releaseOnce(request)
  })
  // Fastify 5 的 onRequestAbort 在客户端断开时触发,此时响应已经没了;
  // 仍要 await 复位语句:连接归还前必须归零是安全动作,不是尽力而为的日志。
  server.addHook('onRequestAbort', async (request: FastifyRequest) => {
    await releaseOnce(request)
  })

  // onRoute:把钩子追加到该路由 preHandler 链**末尾** ⇒ 严格晚于鉴权与能力闸
  server.addHook('onRoute', (routeOptions: RouteOptions) => {
    if (!isScopedContextUrl(routeOptions.url)) return
    const existing = routeOptions.preHandler
    const guard = async (request: FastifyRequest): Promise<void> => {
      await applyRequestContext(request)
    }
    if (existing === undefined) {
      routeOptions.preHandler = [guard]
    } else if (Array.isArray(existing)) {
      routeOptions.preHandler = [...existing, guard]
    } else {
      routeOptions.preHandler = [existing, guard]
    }
  })
}

export default fp(requestContextPlugin, {
  name: 'rls-context-plugin',
  fastify: '5.x',
})

/**
 * 单元测试/脚本辅助:在指定上下文变量内执行 fn(结束即清空)。
 * 注意:连接池场景下 set_config 作用于"当时借到的连接",不保证覆盖 fn 内后续查询 ——
 * 这是 session 变量 + 池化的固有限制,只有事务级 SET LOCAL 才能消除;但"结束即清空"
 * 至少保证这条连接被下一个借用者拿到时不再带 fn 的主体(与插件出口同一动作)。
 */
export async function withRlsContext<T>(
  userId: string,
  roleId: number,
  fn: () => Promise<T>,
  apiKeyId = '',
): Promise<T> {
  await applyRequestContextValues({ userId, roleId: String(roleId), apiKeyId })
  try {
    return await fn()
  } finally {
    await releaseRequestContext()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
