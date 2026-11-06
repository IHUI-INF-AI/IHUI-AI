// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 鉴权默认拒绝(兜底闸)。
 *
 * 现状:`apps/api` 的鉴权靠**每个路由/插件自己手挂** `authenticate` / `requireAdmin` /
 * `requirePermission(...)`,没有根级默认。新增路由忘挂即裸奔 —— 已实测出现过一例
 * (`developer-relay-keys-admin.ts` 读 `request.userId` 却从未鉴权,碰巧 fail-closed 成恒 401)。
 *
 * 做法(沿用本仓 rls-context 的既有招):`onRoute` 把一道兜底 preHandler **追加到每个
 * 路由 preHandler 链的末尾**。Fastify 的钩子顺序是"外层插件 → 内层 → 路由自身 preHandler",
 * 所以轮到兜底时:
 *   · `request.userId` / `request.apiKey` / `request.openCapability` 任一已存在
 *     ⇒ 前面的鉴权已经跑过并放行,**直接放行,不重复查库**;
 *   · 命中显式公开名单 ⇒ 放行;
 *   · 其余 ⇒ 要求认证(未登录 401)。
 *
 * 因此它对已挂鉴权的路由零影响,只兜住"完全没人管"的那一类。
 *
 * 三档(沿用仓库对线上开关的硬要求):
 *   · `off`     —— 完全不介入;
 *   · `observe` —— **默认档**:只记日志(每路径 60s 一条),不拦任何人。
 *                  公开名单不可能一次写全,先上线观察"哪些真实流量会被拦",再补名单;
 *   · `enforce` —— 名单外且无凭据 ⇒ 401。
 *
 * 切档纪律:observe 至少观察 24h 且日志里没有新的(方法+路径)后,再切 enforce。
 * 反向(先 enforce)遇到漏列公开面就是整站 401 —— 那比没有这道闸更糟。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import fp from 'fastify-plugin'
import { checkAuth } from './auth.js'
import { config, runtimeEnv } from '../config/index.js'
import { logger } from '../utils/logger.js'
// BUG-4:公开面清单与段边界匹配收归单一真相源(plugins/public-paths.ts),三处消费方共用同一把尺。
import { isAuthPublicPath as isPublicPath } from './public-paths.js'

export type AuthDefaultDenyMode = 'off' | 'observe' | 'enforce'

/**
 * 档位解析。真 config 恒有值(envSchema 兜底);测试里整对象替换 config 的老写法
 * 走 `off`(与 require-permission 的 resolveAdminTotpMode 同一约定)。
 *
 * 2026-11-01 安全强化(两处,分别住在两个面上,缺一不可):
 *  1. **真正生效的那一格在 schema 默认值**(`config/index.ts`):原先是
 *     `AUTH_DEFAULT_DENY_MODE: z.enum([...]).default('observe')` ⇒ 真实运行时 `raw`
 *     **永远不会是 undefined**,本函数的 undefined 分支只有测试那种"整对象替换 config"
 *     才走到。默认值已改为随运行时档位走:生产 ⇒ enforce,非生产 ⇒ observe。
 *     立因(现读实测):线上那枚值只写在**不进仓**的 `D:\DevEnv\ihui-prod\apps\api\.env`
 *     (=enforce),而仓内 `.env.example` 与整片 `deploy/` 对这一键零登记 ⇒ 一次 `.env`
 *     整体替换(2026-09-26 实测过 55 键被清空,见 `check-env-drift.mjs` 头注)或一次新机
 *     重建,就静默落回 observe(=不拦人)且什么都不响。"生产有没有这道兜底"不该取决于
 *     一个本地文件的存在。
 *  2. 本函数的 undefined 分支同样按生产武装 —— 兜住"将来出现非 schema 的 config 面"。
 *     非生产未写 ⇒ off,不拿没配全的公开名单误伤本地面(本机工作树 `apps/api/.env` 现读
 *     第 1 行 `NODE_ENV=development`,所以这一动不影响本地 dev)。
 *  显式声明一律优先:写 `off` 是有意关掉,写 `observe` 是有意灰度,缺省档不夺权;
 *  档位名拼错落 observe(既不静默放行,也不静默拦死)。
 */
function resolveAuthDefaultDenyMode(): AuthDefaultDenyMode {
  const raw = (config as { AUTH_DEFAULT_DENY_MODE?: string }).AUTH_DEFAULT_DENY_MODE
  if (raw === undefined) return runtimeEnv === 'production' ? 'enforce' : 'off'
  return raw === 'off' || raw === 'enforce' ? raw : 'observe'
}


/**
 * "凭据校验在 handler 内完成"的路由面(2026-11-01 立)—— 兜底闸不得抢在这些路由自己的
 * 校验之前决定成败。
 *
 * 为什么非改不可(现读实测,不是推测):闸的"有没有凭据"这一问走的是 `checkAuth`,而它只读
 * Authorization / cookie。全仓**没有**任何全局 onRequest 验票钩子,于是走
 * `x-internal-service-ticket` / `X-Internal-Secret` / WS `?token=` 的第一方调用在闸眼里
 * 一律等于"无凭据"⇒ 在 handler 之前就被 401。本机 enforce 下抓到的硬证据:
 * `POST /api/ai/callback`(ai-service→api,回环 127.0.0.1:8802)的响应行就是
 * `statusCode":401`,与闸那条 `enforce-401` 日志同 reqId、同毫秒。
 *
 * **每条必须写出"在哪儿验"** —— 空口"它会验"就是给自己开后门:
 *   /api/ai/callback      routes/ai-callback.ts:251-262(未配 secret 时自身 fail-closed 拒一切;
 *                         比对走 internal-service-token 的 secretsEqual 常量时间出口)
 *   /api/internal/relay/  routes/internal-relay-account-pool-credential.ts:40-44(同一 secretsEqual 出口)
 *   /api/memory           routes/memory.ts:161 checkAuthOrInternalService(scope=memory)
 *   /api/agent-control/   routes/agent-control.ts:475 requireAuth / :290 checkAuth(带票读面走内部票校验)
 *   /api/chat/ws/         plugins/ws-helpers.ts:29-39 preValidation 只验 `?token=` 存在,
 *                         :67 wsAuth 才是真校验点
 * 方向:这五条**不因豁免而裸奔** —— 匿名请求穿过闸后仍被 handler 的凭据校验拒掉,变的只是
 * "谁在拒"。新增一条必须能指到 handler 里那行校验代码,指不出就不许加。
 */
const SELF_AUTHENTICATED_PREFIXES: readonly string[] = [
  '/api/ai/callback',
  '/api/internal/relay/',
  '/api/memory',
  '/api/memory/',
  '/api/agent-control/',
  '/api/chat/ws/',
]

/**
 * 段边界安全的匹配:条目不带 `/` 时**只等值**,带 `/` 时才是前缀。
 *
 * 与公开面清单同一把尺(`plugins/public-paths.ts` 的 `matchesPrefix`):BUG-4 已把"无段边界"
 * 的 `path.startsWith(p)` 收敛为统一原语,公开面与自验面现在走同一套段边界语义,不再各写一份。
 */
function isSelfAuthenticatedRoute(rawUrl: string): boolean {
  const path = (rawUrl.split('?')[0] ?? rawUrl) || '/'
  return SELF_AUTHENTICATED_PREFIXES.some((p) =>
    p.endsWith('/') ? path.startsWith(p) : path === p,
  )
}

/** 兜底只看这两类前缀之外的路由(其余如 /uploads 静态面根本不进 Fastify 路由表)。 */
function isInScope(url: string): boolean {
  return (
    url.startsWith('/api/') ||
    url.startsWith('/v1') ||
    url.startsWith('/oauth') ||
    url.startsWith('/.well-known')
  )
}

function isAuthDefaultPublicPath(rawUrl: string): boolean {
  const path = (rawUrl.split('?')[0] ?? rawUrl) || '/'
  // BUG-4:委托给单一真相源(plugins/public-paths.ts),其内已用段边界安全的 matchesPrefix。
  return isPublicPath(path)
}

/** observe 档日志节流:同 (方法+路径) 60s 一条,防被刷时先打满日志盘。 */
const OBSERVE_LOG_INTERVAL_MS = 60_000
const lastLoggedAt = new Map<string, number>()

/**
 * 留痕。tag 三档:
 *   `observe`                —— 灰度档,只记不拦("enforce 下这一条会 401,请确认是否该列名单")
 *   `enforce-401`            —— **确实**被拒了(决策之后才许这么写)
 *   `enforce-credential-ok`  —— 走到闸时不在名单,但 checkAuth 认到了凭据 ⇒ 放行(不是拦截)
 *
 * 2026-11-01 修正:原先调用点在 `checkAuth` **之前**就打 `enforce-401`,于是带有效
 * Bearer/cookie 的请求也被记成"已 401"—— 实测 24h 那 63 行里混着这一类,我一度据此断定
 * "线上在拦 21 条",直到去翻同一 reqId 的响应行才纠正。一个会说谎的读数比没有读数更贵:
 * 它把排查方向主动带偏,而它的形状(已 401)看起来就像证据。
 */
function logObserveHit(
  method: string,
  path: string,
  tag: 'observe' | 'enforce-401' | 'enforce-credential-ok',
): void {
  const key = `${tag} ${method} ${path}`
  const now = Date.now()
  const prev = lastLoggedAt.get(key)
  if (prev !== undefined && now - prev < OBSERVE_LOG_INTERVAL_MS) return
  lastLoggedAt.set(key, now)
  const outcome =
    tag === 'observe'
      ? 'enforce 档下将 401,请确认是否应列入名单'
      : tag === 'enforce-401'
        ? '已 401,若属公开面请补进名单'
        : '凭据有效,已放行(仅记录"该路由没挂任何鉴权 preHandler",请补挂)'
  logger.warn(
    `[auth-default-deny] ${tag} ${method} ${path} ${tag === 'enforce-credential-ok' ? '不在公开名单但带有效凭据' : '无凭据且不在公开名单'} —— ${outcome}`,
    { event: `auth_default_deny_${tag.replace(/-/g, '_')}`, method, path },
  )
}

/**
 * 兜底本体:只在"前面的鉴权一条都没跑过"时才可能拦人。
 * 模块级而非插件内闭包 —— 测试要直接调用它,不复制判据(§22c)。
 */
async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 上游 preHandler 可能已经 send 过(401/403)但仍把链交到这里 —— 再 send 一次会抛
  // "Reply was already sent" 并被全局处理器收敛成 500(2026-10-29 生产实测:
  // /api/knowledge/docs 匿名访问 500 而非 401)。这道判断是根治,不依赖上游写法。
  if (reply.sent) return
  const mode = resolveAuthDefaultDenyMode()
  if (mode === 'off') return
  if (request.method === 'OPTIONS' || request.method === 'HEAD') return
  if (request.userId || request.apiKey || request.openCapability) return
  const path = request.url.split('?')[0] ?? request.url
  if (isAuthDefaultPublicPath(path)) return
  // 凭据校验在 handler 内的面(内部票/内部密钥/WS `?token=`)不由这道闸抢先判死。
  if (isSelfAuthenticatedRoute(path)) return
  if (mode === 'observe') {
    logObserveHit(request.method, path, 'observe')
    return
  }
  await checkAuth(request, reply)
  // enforce 档同样留痕,但**必须在决策之后**问"到底拦没拦":checkAuth 认到凭据就不该冒充 401。
  // 判据取响应本身(reply.statusCode 是结果),而不是再猜一遍凭据字段 —— 两条口径会分叉。
  logObserveHit(
    request.method,
    path,
    reply.statusCode >= 400 ? 'enforce-401' : 'enforce-credential-ok',
  )
}

const authDefaultDeny: FastifyPluginAsync = async (server) => {
  // 追加到每个路由 preHandler 链**末尾** ⇒ 严格晚于路由级/插件级鉴权
  server.addHook('onRoute', (routeOptions: RouteOptions) => {
    const url = routeOptions.url ?? ''
    if (!isInScope(url)) return
    const existing = routeOptions.preHandler
    if (existing === undefined) {
      routeOptions.preHandler = [authGuard]
    } else if (Array.isArray(existing)) {
      routeOptions.preHandler = [...existing, authGuard]
    } else {
      routeOptions.preHandler = [existing, authGuard]
    }
  })
}

export default fp(authDefaultDeny, { name: 'auth-default-deny', fastify: '5.x' })

export const __test__ = {
  authGuard,
  isAuthDefaultPublicPath,
  isSelfAuthenticatedRoute,
  resolveAuthDefaultDenyMode,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
