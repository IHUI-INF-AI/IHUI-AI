import { NextResponse, type NextRequest } from 'next/server'

/**
 * Edge Runtime 安全的密码学随机 hex 生成器(Web Crypto API,无 Math.random 降级)
 * 2026-07-21 加固:用于 OAuth state 生成,防止 CWE-330 可预测随机漏洞
 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  let hex = ''
  for (let i = 0; i < bytes; i++) {
    hex += (buf[i] ?? 0).toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * 服务端 SSO 鉴权 middleware（迁移自 D 盘 edu/admin/admin/src/router/guard.js + edu/web/src/router/guard.js）。
 *
 * 触发条件:访问 /admin/* 路径且 cookie 中无 auth_token。
 * 行为:307 重定向到 /sso/login,携带 redirect 参数指向原始路径。
 *
 * 说明:
 * - middleware 在 Edge Runtime 运行,无法读取 Zustand persist(localStorage)。
 *   故鉴权依据为 cookie 中的 `auth_token`(由 apps/web/src/lib/cookie-utils.ts 写入,
 *   与 Zustand store 同步设置)。
 * - token 有效性由 API 端(Bearer 校验)负责,middleware 只做空值检查,避免在 Edge 调用 API。
 * - 公开路径白名单迁移自 D2 web guard L10-31。
 *
 * 分域 SSO (2026-07-21):
 * - 认证子域 bsm.aizhs.top → 仅放行 auth 路径(/sso/*, /auth/*, /callback, /api/auth/*),
 *   其余路径 307 跳回主域 aizhs.top,避免子域承载主功能。
 * - 主域 aizhs.top → 走原鉴权逻辑。
 * - host 解析:用 request.headers.get('host') 优先,fallback request.nextUrl.host。
 *   Edge Runtime 下 nextUrl.host 可能为空,headers 一定可用。
 */

const ADMIN_PATH_PREFIX = '/admin'
const SSO_LOGIN_PATH = '/sso/login'
const AUTH_COOKIE_NAME = 'auth_token'

/** 认证子域 host 字面量(env 不可用,Edge 中无法读 process.env.NEXT_PUBLIC_*) */
const AUTH_SUBDOMAIN_HOST = 'bsm.aizhs.top'
/** 主域 host 字面量(用于回跳目标拼接) */
const MAIN_DOMAIN_HOST = 'aizhs.top'

/** 公开路径白名单(无需鉴权即可访问)。 */
const PUBLIC_PATHNAMES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/sso/login',
  '/sso/redirect',
  '/sso/register',
  '/sso/auth',
  '/auth/callback',
  '/auth/apple/callback',
  '/auth/google/callback',
  '/about',
  '/contact',
  '/pricing',
  '/help',
  '/docs',
  '/forbidden',
  '/not-found',
  '/qr-confirm',
]

/** 公开路径前缀(以 prefix 匹配)。 */
const PUBLIC_PREFIXES = [
  '/h5/share/',
  '/api/health',
  '/api/auth/',
  '/api/sso/',
  '/_next/',
  '/favicon',
]

/**
 * 认证子域允许路径白名单 — 只承载登录/OAuth 回调,主功能全部 307 跳回主域。
 * 静态资源 / Next.js 内部 / favicon 始终放行,避免样式/字体加载被截。
 */
const AUTH_SUBDOMAIN_ALLOWED_PATHNAMES = [
  '/sso/login',
  '/sso/redirect',
  '/sso/register',
  '/sso/auth',
  '/auth/callback',
  '/auth/apple/callback',
  '/auth/google/callback',
  '/callback',
  '/forbidden',
  '/not-found',
]

const AUTH_SUBDOMAIN_ALLOWED_PREFIXES = [
  '/sso/',
  '/auth/',
  '/api/auth/',
  '/api/sso/',
  '/oauth/mock/', // 分域 SSO mock 授权页(2026-07-21):保持子域内完成 mock OAuth,callback 在子域写跨域 Cookie
  '/_next/',
  '/images/',
  '/favicon',
  '/icon',
  '/apple-icon',
  '/manifest',
  '/robots.txt',
  '/sitemap',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHNAMES.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

function isAllowedOnAuthSubdomain(pathname: string): boolean {
  if (AUTH_SUBDOMAIN_ALLOWED_PATHNAMES.includes(pathname)) return true
  return AUTH_SUBDOMAIN_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))
}

function getRequestHost(request: NextRequest): string {
  // 优先用 headers,Edge Runtime 下 nextUrl.host 可能为空
  const headerHost = request.headers.get('host') || request.headers.get('x-forwarded-host')
  if (headerHost) return headerHost.toLowerCase().split(':')[0]!
  return request.nextUrl.hostname.toLowerCase()
}

/** 从 host 字符串中提取纯 host(去端口) */
function stripPort(host: string): string {
  return host.split(':')[0]!.toLowerCase()
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const rawHost = getRequestHost(request)
  const host = stripPort(rawHost)

  // ===== 分域 SSO:认证子域 =====
  if (host === AUTH_SUBDOMAIN_HOST) {
    // 支付宝 server-side redirect(绕过客户端 React hydration 失败,2026-07-21 立)
    // 用户访问 bsm.aizhs.top/sso/auth?platform=alipay → middleware 直接 302 跳到支付宝授权页
    if (pathname === '/sso/auth') {
      const platform = request.nextUrl.searchParams.get('platform')
      if (platform === 'alipay') {
        const appId = process.env.NEXT_PUBLIC_ALIPAY_APP_ID
        const redirectUri = process.env.NEXT_PUBLIC_ALIPAY_REDIRECT_URI
        if (appId && redirectUri) {
          const scope = process.env.NEXT_PUBLIC_ALIPAY_SCOPE || 'auth_user'
          const state = `alipay_${Date.now()}_${randomHex(16)}`
          const authUrl = new URL('https://openauth.alipay.com/oauth2/publicAppAuthorize.htm')
          authUrl.searchParams.set('app_id', appId)
          authUrl.searchParams.set('scope', scope)
          authUrl.searchParams.set('redirect_uri', redirectUri)
          authUrl.searchParams.set('state', state)
          const res = NextResponse.redirect(authUrl, 302)
          // 保存 state 到 cookie,回调时校验(防 CSRF)
          res.cookies.set('alipay_oauth_state', state, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 600,
            domain: '.aizhs.top',
          })
          return res
        }
      }
    }

    if (isAllowedOnAuthSubdomain(pathname)) {
      return NextResponse.next()
    }
    // 其它路径全部 307 跳回主域同路径
    const mainUrl = new URL(`${pathname}${search}`, `https://${MAIN_DOMAIN_HOST}`)
    return NextResponse.redirect(mainUrl, 307)
  }

  // ===== 主域(or 其它任意 host):原鉴权逻辑 =====
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 仅对 /admin/* 做强制鉴权(用户中心等其余路径由客户端 + API 401 兜底)
  if (!pathname.startsWith(ADMIN_PATH_PREFIX)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (token && token.length > 0) {
    return NextResponse.next()
  }

  // 未登录访问 admin → 重定向到 SSO 登录页,携带 redirect 回跳参数
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = SSO_LOGIN_PATH
  loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(loginUrl, 307)
}

export const config = {
  /**
   * 匹配所有路径,但排除 Next.js 内部静态资源 / 公开 API。
   * middleware 内部再做白名单与 admin 前缀判断。
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
