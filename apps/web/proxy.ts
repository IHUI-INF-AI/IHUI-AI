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
 * G 盘 IHUI-AI(统一入口):
 *   - PC 主入口:    /sso/login            (SaaS 风格独立页 + 扫码登录)
 *   - 弹窗入口:     (auth)/login dialog   (openLoginDialogOnce,懒触发,见 src/lib/login-dialog-trigger.ts)
 *   - 移动端:       (auth)/callback/*     (OAuth callback 路由组)
 *
 * 兼容性:若需保留 D 盘旧路径,可在此处添加 redirect 规则,例如:
 *   if (pathname === '/auth/login') {
 *     return NextResponse.redirect(new URL('/sso/login', request.url))
 *   }
 * 当前未启用(项目已统一切换到 /sso/login,旧路径无外部引用)。
 *
 * ============================================================================
 * P0-1:未登录访问 /admin/* 时 307 重定向到 SSO 登录页
 * ============================================================================
 * - token 校验:src/lib/auth-utils.ts 的 verifyAccessTokenEdge(Web Crypto API,Edge 兼容)
 * - cookie 读取:auth_token(与 src/lib/cookie-utils.ts 一致),只验签不查库
 * - 重定向目标:/sso/login?redirect=<encoded-original-url>(307 保留 method)
 * - 不阻塞:/admin/unauthorized(让用户看到无权限页)
 *
 * ============================================================================
 * D2 web guard 公开页白名单(迁移自 D:\历史项目存档\code\edu\client\web\web\src\router\guard.js L10-31)
 * ============================================================================
 * 当前 matcher 只匹配 /admin/*,以下白名单仅作文档化(后续扩展 matcher 时复用):
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

const AUTH_COOKIE = 'auth_token'
const LOGIN_PATH = '/sso/login'
const UNAUTHORIZED_PATH = '/admin/unauthorized'

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // 不阻塞 /admin/unauthorized(让用户看到无权限页)
  if (pathname === UNAUTHORIZED_PATH) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (token && (await verifyAccessTokenEdge(token))) {
    return NextResponse.next()
  }

  // 无 token 或验签失败 → 307 重定向到 SSO 登录页
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = LOGIN_PATH
  loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(loginUrl, 307)
}

export const config = {
  // 仅匹配 /admin/*,避免匹配静态资源 / api / _next(由 Next.js 自动跳过)
  matcher: ['/admin/:path*'],
}
