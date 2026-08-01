/**
 * 纯前端鉴权工具函数(跨端共享,零平台依赖)。
 *
 * 来源:原 apps/web/src/lib/auth-utils.ts 中的 3 个纯函数(decodeUserFromToken / isAdmin / isAuthenticated)
 * 与 AuthTokenUser 接口,2026-08-01 下沉到共享层(AGENTS.md §3 共享层优先)。
 *
 * 依赖:base64UrlDecode(../utils/jwt-utils,纯 JS 实现,兼容 Edge/browser/RN/Taro)。
 *
 * 注意:JWTPayload 类型不直接从 @ihui/auth import,因为:
 * - @ihui/auth 不是 @ihui/shared 的依赖(避免 node:crypto + ioredis 传递到前端)
 * - TypeScript rootDir 约束不允许跨包相对路径 import type
 * 改为本地定义结构等价的 JWTPayload 镜像类型,AuthTokenUser 仍 extends Partial<JWTPayload> 保持类型契约。
 * 字段与 packages/auth/src/jwt.ts 的 JWTPayload 保持同步,如后端变更需同步更新此处。
 */
import { base64UrlDecode } from '../utils/jwt-utils'

/**
 * 镜像 @ihui/auth JWTPayload 的结构类型(仅类型,无运行时依赖)。
 * 字段与 packages/auth/src/jwt.ts 的 JWTPayload 保持同步。
 * 不 export 以避免与 @ihui/auth 的 JWTPayload 命名冲突。
 */
interface JWTPayload {
  userId: string
  phone: string
  familyId: string
  roleId: number
}

/**
 * JWT payload 中与前端鉴权相关的字段。
 * 复用 JWTPayload(userId/phone/familyId/roleId)的 Partial,并补充前端守卫所需的标准 JWT 声明(exp/iat)与兼容字段(role/type)。
 */
export interface AuthTokenUser extends Partial<JWTPayload> {
  role?: string
  exp?: number
  iat?: number
  type?: string
}

/**
 * 解码 JWT payload 获取 user 信息(不验签,仅读取 payload)。
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
 * 与后端一致:roleId >= 1(ADMIN_ROLE_ID = 1)视为系统管理员,直接放行。
 * 兼容字符串 role 字段('admin' / 'administrator')。
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
 * 检查 token 是否存在且未过期(仅本地校验,不验签)。
 * 真正的签名校验由后端 @ihui/auth 完成;此处仅做前端守卫的快速拦截。
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
