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

async function applyContextValues(values: {
  userId: string
  roleId: string
  apiKeyId: string
}): Promise<void> {
  try {
    await db.execute(
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
 * 每请求一次:① 写会话变量;② 对 scoped 机器能力执行"非超级用户"断言。
 * 抛出的 DataScopeViolationError(403)由全局 errorHandler 渲染。
 */
export async function applyRequestContext(request: FastifyRequest): Promise<void> {
  if (!isScopedContextUrl(request.url)) return
  const values = contextValuesOf(request)
  await applyContextValues(values)

  const principal = request.principal
  if (!isDataScopeEnforced(principal)) return
  // 探测结果进程内缓存(10 分钟),不会给每个请求增加一次往返
  await assertNonSuperuserForScopedMode(dbModeForPrincipal(principal))
}

const requestContextPlugin: FastifyPluginAsync = async (server) => {
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
 * 这是 session 变量 + 池化的固有限制,只有事务级 SET LOCAL 才能消除。
 */
export async function withRlsContext<T>(
  userId: string,
  roleId: number,
  fn: () => Promise<T>,
  apiKeyId = '',
): Promise<T> {
  await applyContextValues({ userId, roleId: String(roleId), apiKeyId })
  try {
    return await fn()
  } finally {
    await applyContextValues({ userId: '', roleId: '', apiKeyId: '' })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
