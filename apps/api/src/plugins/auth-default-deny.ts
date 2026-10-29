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
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

export type AuthDefaultDenyMode = 'off' | 'observe' | 'enforce'

/**
 * 档位解析。真 config 恒有值(envSchema 兜底);测试里整对象替换 config 的老写法
 * 走 `off`(与 require-permission 的 resolveAdminTotpMode 同一约定)。
 */
export function resolveAuthDefaultDenyMode(): AuthDefaultDenyMode {
  const raw = (config as { AUTH_DEFAULT_DENY_MODE?: string }).AUTH_DEFAULT_DENY_MODE
  if (raw === undefined) return 'off'
  return raw === 'off' || raw === 'enforce' ? raw : 'observe'
}

/**
 * 完全匿名的面。
 *
 * 注意:这里**不需要**列"已有鉴权的路由" —— 它们自己的 preHandler 先跑并 401,
 * 兜底只是第二道。列在这里的唯一含义是"这条路径没有、也不需要登录".
 * 名单偏宽是安全的(最坏等于该路径不设兜底),偏窄会误拦真实流量 ⇒ 新增一律先 observe。
 */
const PUBLIC_EXACT: ReadonlySet<string> = new Set([
  '/',
  '/health',
  '/ready',
  '/live',
  '/metrics',
  '/business-metrics',
  '/api/health',
  '/api/metrics',
  '/api/business-metrics',
  '/api/csrf-token',
  '/api/landing',
  '/api/version',
  '/.well-known/agent.json',
  '/.well-known/agent-card.json',
  '/.well-known/apple-app-site-association',
  '/.well-known/assetlinks.json',
])

const PUBLIC_PREFIXES: readonly string[] = [
  // 探活与指标
  '/api/health/',
  // 静态与公开文件
  '/uploads/',
  '/api/oss/public/',
  '/api/public/',
  // 登录/注册/OAuth/SSO 入口(各端点自己决定要不要凭据)
  '/api/auth/',
  '/api/oauth/',
  '/oauth/',
  '/api/sso/',
  // 外部平台回调(签名校验,不走 JWT)
  '/api/callback/',
  '/api/webhooks/',
  '/api/payments/',
  '/api/payment/',
  '/api/cozeZhsApi/',
  // 2026-10-29 observe 档上线 5 分钟即抓到的真实流量:GitHub App webhook 走 HMAC 验签
  // (services/github-app/signature.ts),匿名到达。漏了这一条就切 enforce = CI 回调全 401。
  '/api/github-app/',
  // 协议发现
  '/.well-known/',
  // 机器面(API Key 自证;requireApiKeyAuth 会写 request.apiKey)
  '/v1/',
  '/v1beta/',
  '/api/mcp',
  // 公开市场与公开内容
  '/api/agents',
  '/api/categories',
  '/api/landing/',
  '/api/voice/',
  '/api/crash-reports',
]

/** 兜底只看这两类前缀之外的路由(其余如 /uploads 静态面根本不进 Fastify 路由表)。 */
function isInScope(url: string): boolean {
  return (
    url.startsWith('/api/') ||
    url.startsWith('/v1') ||
    url.startsWith('/oauth') ||
    url.startsWith('/.well-known')
  )
}

export function isAuthDefaultPublicPath(rawUrl: string): boolean {
  const path = (rawUrl.split('?')[0] ?? rawUrl) || '/'
  if (PUBLIC_EXACT.has(path)) return true
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))
}

/** observe 档日志节流:同 (方法+路径) 60s 一条,防被刷时先打满日志盘。 */
const OBSERVE_LOG_INTERVAL_MS = 60_000
const lastLoggedAt = new Map<string, number>()

function logObserveHit(method: string, path: string): void {
  const key = `${method} ${path}`
  const now = Date.now()
  const prev = lastLoggedAt.get(key)
  if (prev !== undefined && now - prev < OBSERVE_LOG_INTERVAL_MS) return
  lastLoggedAt.set(key, now)
  logger.warn(
    `[auth-default-deny] ${method} ${path} 无凭据且不在公开名单 —— enforce 档下将 401,请确认是否应列入名单`,
    { event: 'auth_default_deny_observe', method, path },
  )
}

/**
 * 兜底本体:只在"前面的鉴权一条都没跑过"时才可能拦人。
 * 模块级而非插件内闭包 —— 测试要直接调用它,不复制判据(§22c)。
 */
export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const mode = resolveAuthDefaultDenyMode()
  if (mode === 'off') return
  if (request.method === 'OPTIONS' || request.method === 'HEAD') return
  if (request.userId || request.apiKey || request.openCapability) return
  const path = request.url.split('?')[0] ?? request.url
  if (isAuthDefaultPublicPath(path)) return
  if (mode === 'observe') {
    logObserveHit(request.method, path)
    return
  }
  await checkAuth(request, reply)
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

export const __test__ = { authGuard, isAuthDefaultPublicPath, resolveAuthDefaultDenyMode }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
