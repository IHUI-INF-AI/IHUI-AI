/**
 * Admin 角色判定工具。
 *
 * 数据源:`AuthUser.roleId`(0 普通用户,>=1 管理员,具体阈值由后端 roles 表决定)。
 * 桌面端沿用 web `getProfile()` 返回的 roleId 字段(已在 ProfilePage 复用)。
 */
import type { AuthUser } from '@ihui/api-client'

export const ADMIN_ROLE_THRESHOLD = 1

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  return (user.roleId ?? 0) >= ADMIN_ROLE_THRESHOLD
}
