import { NextResponse, type NextRequest } from 'next/server'

import { decodeUserFromToken, isAdmin, isAuthenticated } from '@/lib/auth-utils'

/**
 * 前端 RBAC 路由守卫（Edge 运行时）。
 * - 公开路由放行
 * - /admin 路由：校验登录 + 管理员角色（roleId >= 1）
 * - 受保护用户路由：校验登录
 * - 其他放行
 *
 * 注意：签名校验由后端 @ihui/auth 完成，此处仅做前端快速拦截，减少敏感页面暴露。
 */

/** 公开路由(精确匹配或前缀匹配) */
const PUBLIC_PATHS = [
  '/sso/login',
  '/sso/register',
  '/sso/redirect',
  '/forgot-password',
  '/callback',
  '/google/callback',
  '/apple/callback',
]

/** admin 路由前缀 */
const ADMIN_PREFIX = '/admin'

/** 需要登录的受保护用户路由前缀（非 admin） */
const PROTECTED_PREFIXES = [
  '/user',
  '/wallet',
  '/orders',
  '/distribution',
  '/settings',
  '/favorites',
  '/notifications',
  '/messages',
  '/invitations',
  '/following',
  '/security-audit',
  '/refund',
]

function isPublic(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function isAdminRoute(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(ADMIN_PREFIX + '/')
}

/** 从 cookie 读取 token，兼容 auth_token 与 token 两个名称 */
function getToken(request: NextRequest): string | null {
  return request.cookies.get('auth_token')?.value ?? request.cookies.get('token')?.value ?? null
}

/** 重定向到首页并设置 login_redirect cookie(5min),触发 LoginDialog */
function redirectToLoginDialog(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.search = ''
  const res = NextResponse.redirect(url)
  res.cookies.set('login_redirect', pathname, {
    path: '/',
    maxAge: 300,
    sameSite: 'lax',
    httpOnly: true,
  })
  return res
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // a. 公开路由放行
  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  const token = getToken(request)

  // b. admin 路由：校验登录 + 角色
  if (isAdminRoute(pathname)) {
    if (!token || !isAuthenticated(token)) {
      return redirectToLoginDialog(request, pathname)
    }
    const user = decodeUserFromToken(token)
    if (!isAdmin(user)) {
      // 非管理员 → 重定向首页并附带无权限标识
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      url.searchParams.set('no_permission', '1')
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // c. 其他受保护路由：仅校验登录
  if (isProtected(pathname)) {
    if (!token || !isAuthenticated(token)) {
      return redirectToLoginDialog(request, pathname)
    }
    return NextResponse.next()
  }

  // d. 其他放行
  return NextResponse.next()
}

export const config = {
  /** 排除静态资源，仅对页面与 API 路由生效 */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
