// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IHUI-AI Web 顶层 Middleware(P0-1 + P3-4)。
 *
 * ============================================================================
 * P3-4:SSO 路径变更文档化(D 盘历史项目 → G 盘 IHUI-AI)
 * ============================================================================
 * D 盘历史项目(3 套独立登录入口,已废弃):
 *   - D1 admin(sso):/sso/login           (Vue Router 守卫跳转)
 *   - D2 web:        /login               (Vue Router beforeEach 守卫)
 *   - D4 mobile:     /auth/login          (uni-app)
 *
 * G 盘 IHUI-AI(两条入口,语义不同,不是"统一到一条"):
 *   - 普通登录入口: /login                (软路由 app/login/:挂载即打开全局 LoginDialog 再回前一页,
 *                                          无来路降级首页;并承担 ?method=qr&embed=true 的 RN WebView 嵌二维码)
 *   - SSO 授权页:   /sso/login            (全屏独立页,供外部子项目带 ?redirect= 进来授权;
 *                                          即本文件下方鉴权射程 307 的目标页)
 *   - 弹窗基座:     src/lib/login-dialog-trigger.ts(openLoginDialogOnce,懒触发)
 *   - 移动端:       (auth)/callback/*     (OAuth callback 路由组)
 *
 * 兼容性:若需保留 D 盘旧路径,可在此处添加 redirect 规则,例如:
 *   if (pathname === '/auth/login') {
 *     return NextResponse.redirect(new URL('/sso/login', request.url))
 *   }
 * 当前未启用:`/auth/login` 在本仓无任何引用面,故不需要这条规则。另一条同型规则已经出过事故并
 * 被摘除:2026-08-25 随 D 盘老口径接线的 `/login → /sso/login` 永久重定向,会把上面那条 /login
 * 软路由整页顶成本 SSO 授权页(普通用户被引导进"为 web 授权"的话术),现已不在
 * src/config/redirects.config.ts 中,该表内注释 + apps/web/tests/auth-login-route-redirect.test.ts
 * 是它的锁;不得加回。
 *
 * ============================================================================
 * P0-1:未登录访问受保护页(仅 /admin/* 与 /edu/edu-management/*)时 307 重定向到 SSO 授权页
 * ============================================================================
 * - token 校验:src/lib/auth-utils.ts 的 verifyAccessTokenEdge(Web Crypto API,Edge 兼容)
 * - cookie 读取:auth_token(与 src/lib/cookie-utils.ts 一致),只验签不查库
 * - 重定向目标:/sso/login?redirect=<encoded-original-url>(307 保留 method)
 * - 不阻塞:/admin/unauthorized(让用户看到无权限页)
 * - 不覆盖:/login(普通登录入口 = 打开全局 LoginDialog 的软路由),它若被重定向成本页下方那条
 *   SSO 授权页即是 2026-08-25 那次接线事故的复现
 *
 * ============================================================================
 * D2 web guard 公开页白名单(迁移自 D:\历史项目存档\code\edu\client\web\web\src\router\guard.js L10-31)
 * ============================================================================
 * config.matcher 现为全站 `/:path*`(源站直连守卫要求全请求面生效,见文件末 config),但**鉴权射程
 * 仍由函数内 isProtectedPath 限定为 /admin 与 /edu/edu-management**;以下白名单仅作文档化:
 *   /, /login, /register, /forget-password, /forgot-password, /reset-password,
 *   /agreement, /about, /help, /feedback, /contact, /pricing, /docs,
 *   /sso/*, /share/*, /api/*, /_next/*, /favicon.ico, /admin/unauthorized
 * G 盘扩展(与 src/lib/login-dialog-trigger.ts PUBLIC_PATHS 对齐):
 *   /sso/register, /sso/auth, /sso/redirect, /api/health
 *
 * ============================================================================
 * ⚠️ 关键限制:output:'export' 模式下 middleware 生产环境不生效
 * ============================================================================
 * next.config.ts L5 配置 output:'export'(静态导出供 Tauri WebView 加载),
 * Next.js 官方文档明确 middleware 在该模式下不工作(只在 `next dev` 模式生效):
 *   https://nextjs.org/docs/app/api-reference/file-conventions/middleware
 *
 * 生产部署等价方案(由 nginx/CDN 层实现):
 *   location /admin/ {
 *     if ($cookie_auth_token = "") { return 307 /sso/login?redirect=$request_uri; }
 *     # token 验签由后端 /api/auth/verify 完成(可选;性能敏感时可只判 cookie 存在性)
 *   }
 *   location = /admin/unauthorized { try_files $uri /index.html; }
 *
 * 当前 middleware 在 dev 模式(pnpm dev)生效,提供开发期 FOUC 防护 + JS bundle 信息泄露防护;
 * 生产环境需配合上述 nginx 配置(由部署侧负责)。
 * ============================================================================
 */

import { NextResponse, type NextRequest } from 'next/server'
import { verifyAccessTokenEdge } from '@/lib/auth-utils'
import { evaluateOriginHostGuard } from '@/lib/origin-direct-host-guard'
// 鉴权射程(2026-10-21 随 matcher 全站化迁入函数内,逐字等价于旧 matcher
// `['/admin/:path*', '/edu/edu-management/:path*']` 的命中集,不多不少)。
// 2026-10-26:判据迁到 lib/protected-paths 单一源 —— /sso/login 的自动回跳要问同一件事。
import { isProtectedPath } from '@/lib/protected-paths'
import { buildCsp } from '@/config/csp'
import { isPublicCacheablePath } from '@/config/public-html-cache'

const AUTH_COOKIE = 'auth_token'
const REFRESH_COOKIE = 'refresh_token'
const LOGIN_PATH = '/sso/login'
const UNAUTHORIZED_PATH = '/admin/unauthorized'

const isDev = process.env.NODE_ENV === 'development'

/**
 * 这些路径上的响应不是 HTML(或是不需要策略的静态资产),不参与 nonce 分发。
 * 判据刻意保守:只有明确的资产前缀与带扩展名的文件名走这条,其余一律按 HTML 处理 ——
 * 漏发 nonce 的代价是白屏,多发一次的代价只是几十字节。
 */
function isNonHtmlPath(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/__nextjs')) return true
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
  return lastSegment.includes('.')
}

/**
 * 逐请求 CSP nonce(2026-10-30 立)。
 *
 * 为什么必须在这里:nonce 的整个价值在于**每条响应都不一样**,而 `next.config.ts` 的
 * `headers()` 是构建期常量。Next 又从**请求头**的 `content-security-policy` 里读 nonce
 * 并给自己生成的 inline bootstrap script 打上它 —— 能在请求期改请求头的地方只有本文件
 * (Next 16 起 middleware 的正式文件名就是 proxy.ts)。
 *
 * ⚠️ 两条动一下就白屏的约束:
 *   ① 请求头与响应头必须写**同一条字符串**(Next 按请求头打 nonce,浏览器按响应头校验);
 *   ② nonce 分支必须不带 `'unsafe-inline'`(CSP3 下它会被忽略,留着只会误导排查的人)。
 *   两条都住在 `src/config/csp.ts`,这里只负责"分发"。
 *
 * 与公开可缓存页的关系:那批页面走 `next.config.ts` 那一份(无 nonce、可 s-maxage 共享缓存)。
 * per-request nonce 与共享缓存互斥(缓存件里的 nonce 会被跨用户复用),取舍全文见
 * `src/config/public-html-cache.ts` 头注。这里对它们原样放行,不加第二份策略。
 */
/**
 * 只在进程间存在的内部端点前缀(不允许从公网/浏览器到达)。
 * 与 apps/api 的 `/api/internal/` 族、ai-service 的 `/ai-service/internal/` 族一一对应;
 * 新增内部族必须同步这里与 apps/api 的 INTERNAL_ONLY_PREFIXES(两处都是显式列举,
 * 不做正则兜底 —— 兜底会把同名静态子路由一起放行)。
 */
const INTERNAL_PATH_PREFIXES = ['/api/internal', '/ai-service/internal'] as const

/** 命中判据:整段等于前缀,或其后紧跟 `/`。不做子串匹配(`/api/internal-audit` 不受影响)。 */
function isInternalPath(pathname: string): boolean {
  return INTERNAL_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export async function proxy(request: NextRequest) {
  // 源站直连守卫:只拒「Host 为裸公网 IP 字面量」;空/畸形/域名/私网一律放行。
  // 判据与立项边界见 src/lib/origin-direct-host-guard.ts。403 响应体不携带任何内部信息。
  const hostGuard = evaluateOriginHostGuard(request.headers.get('host'))
  if (!hostGuard.allowed) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { pathname, search } = request.nextUrl

  // ── 内部服务端点边缘封禁(2026-10-31 安全强化第 14 批)──────────────────────
  // 本机前门是 EdgeOne/Cloudflared → 本进程(8801) → rewrites → Fastify(8802)。
  // `/api/:path*` 是通配 rewrite,所以 `/api/internal/*`(号池凭据回写、用户池
  // upsert/delete、MCP 状态广播、工具调用台账摄入)结构上会从公网直达,防线只剩
  // 单一 X-Internal-Secret。这些端点的语义是「本机进程间调用」,不经过本进程 ——
  // 内部服务直连 127.0.0.1:8802,不经 8801,故此处拒绝一切外部到达。
  // 第二层在 apps/api 的 network-segment `denyProxied`(与 IP 分类解耦,不信 XFF)。
  if (isInternalPath(pathname)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // ── CSP nonce 分发(2026-10-30,机制与取舍见 makeNonce 头注)──
  // 两类路径不发 nonce:非 HTML 资产(纯浪费,还会污染 CDN 缓存键)、
  // 公开可缓存页(per-request nonce 与 s-maxage 共享缓存互斥)。
  let nonce: string | null = null
  let csp: string | null = null
  if (!isNonHtmlPath(pathname) && !isPublicCacheablePath(pathname)) {
    nonce = makeNonce()
    csp = buildCsp({ nonce, dev: isDev })
  }
  // 所有"放行"出口都走这里:请求头带 nonce 供 Next 给自己的脚本打标,响应头带同一份策略供浏览器校验。
  const pass = (): NextResponse => {
    if (!csp || !nonce) return NextResponse.next()
    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('x-nonce', nonce)
    reqHeaders.set('content-security-policy', csp)
    const res = NextResponse.next({ request: { headers: reqHeaders } })
    res.headers.set('content-security-policy', csp)
    return res
  }

  // matcher 已扩为全站:非鉴权射程的请求在此原样放行(行为与旧窄 matcher 等价)
  if (!isProtectedPath(pathname)) {
    return pass()
  }

  // 不阻塞 /admin/unauthorized(让用户看到无权限页)
  if (pathname === UNAUTHORIZED_PATH) {
    return pass()
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (token && (await verifyAccessTokenEdge(token))) {
    return pass()
  }

  // access JWT 只有 15 分钟,cookie 却活 30 天:过期是**常态**,不是登出。
  // 此前这里直接 307,把用户扔进 /sso/login 的授权卡片(该页只有企业 SSO 回跳才自动回去),
  // 表现就是「后台待一会儿,点什么都被要求重新登录/授权」(2026-10-26 用户实测)。
  // refresh_token 仍在 ⇒ 会话可恢复 ⇒ 放行到页面,由客户端 bootstrap / 401 拦截器
  // 静默刷新并续种 auth_token(后端 /auth/refresh 会 setAuthCookies)。
  // 没有 refresh 的匿名访问照旧 307 —— 守卫不失效;数据面仍由 API 验签兜底。
  if (request.cookies.get(REFRESH_COOKIE)?.value) {
    return pass()
  }

  // 无 token 且无 refresh → 307 重定向到 SSO 登录页
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = LOGIN_PATH
  loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`
  const redirectRes = NextResponse.redirect(loginUrl, 307)
  if (csp) redirectRes.headers.set('content-security-policy', csp)
  return redirectRes
}

export const config = {
  // 2026-10-21 源站直连守卫要求全请求面生效(8801 已公网可达,拦截面不能只住在 /admin 下),
  // matcher 由窄射程扩为全站;原「仅 /admin/* 与 /edu/edu-management/* 走鉴权重定向」的
  // 射程逐字保持,由函数内 isProtectedPath 判定(命中集与旧 matcher 等价,不多不少)。
  matcher: ['/:path*'],
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
