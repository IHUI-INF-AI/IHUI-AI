import type { NextRequest } from 'next/server'

/**
 * JWT payload 中与前端鉴权相关的字段。
 * 与后端 @ihui/auth 的 JWTPayload 对应（sub=userId, roleId, exp 等）。
 */
export interface AuthTokenUser {
  userId?: string
  roleId?: number
  role?: string
  exp?: number
  iat?: number
  type?: string
}

/**
 * base64url → UTF-8 字符串。
 * 仅使用 Web API（atob / TextDecoder），兼容 Edge 运行时，不依赖 Node Buffer。
 */
function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * 解码 JWT payload 获取 user 信息（不验签，仅读取 payload）。
 * 返回 null 表示 token 格式无效或 payload 无法解析。
 */
export function decodeUserFromToken(token: string): AuthTokenUser | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const payloadPart = parts[1]
  if (!payloadPart) return null
  try {
    return JSON.parse(base64UrlDecode(payloadPart)) as AuthTokenUser
  } catch {
    return null
  }
}

/**
 * 判断用户是否为管理员。
 * 与后端一致：roleId >= 1（ADMIN_ROLE_ID = 1）视为系统管理员，直接放行。
 * 兼容字符串 role 字段（'admin' / 'administrator'）。
 */
export function isAdmin(user: AuthTokenUser | null): boolean {
  if (!user) return false
  if (typeof user.roleId === 'number' && user.roleId >= 1) return true
  if (typeof user.role === 'string') {
    const r = user.role.toLowerCase()
    return r === 'admin' || r === 'administrator'
  }
  return false
}

/**
 * 检查 token 是否存在且未过期（仅本地校验，不验签）。
 * 真正的签名校验由后端 @ihui/auth 完成；此处仅做前端守卫的快速拦截。
 */
export function isAuthenticated(token: string | null | undefined): boolean {
  if (!token) return false
  const user = decodeUserFromToken(token)
  if (!user) return false
  if (typeof user.exp === 'number') {
    const now = Math.floor(Date.now() / 1000)
    if (now >= user.exp) return false
  }
  return true
}

/**
 * 获取 redirect 查询参数。
 * 仅允许站内相对路径（以单个 / 开头），防止开放重定向攻击。
 */
export function getRedirectPath(request: NextRequest): string {
  const redirect = request.nextUrl.searchParams.get('redirect')
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  return '/'
}
