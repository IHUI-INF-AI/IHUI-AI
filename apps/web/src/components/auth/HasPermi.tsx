'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'

export interface HasPermiProps {
  code: string | string[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

function checkPermission(userPermissions: string[] | undefined, code: string | string[]): boolean {
  if (userPermissions === undefined) return true
  if (userPermissions.length === 0) return false
  if (userPermissions.includes('*:*:*') || userPermissions.includes('*')) return true
  const codes = Array.isArray(code) ? code : [code]
  return codes.some((c) => userPermissions.includes(c))
}

export function HasPermi({ code, fallback = null, children }: HasPermiProps) {
  // 性能修复(2026-07-25):原 useAuthStore((s) => s.user) 全订阅 user 对象,
  // 任何 setUser 调用(登录 / profile 刷新 / auth bootstrap / persist hydration)
  // 都触发本组件重渲染(及其包裹的整棵子树)。改为只订阅 permissions 字段,
  // 仅在 permissions 数组引用变化时重渲染。
  const permissions = useAuthStore((s) => s.user?.permissions)
  const hasPermission = checkPermission(permissions, code)
  if (!hasPermission) return <>{fallback}</>
  return <>{children}</>
}

export function useHasPermi(code: string | string[]): boolean {
  // 性能修复(2026-07-25):同 HasPermi,只订阅 permissions 字段。
  const permissions = useAuthStore((s) => s.user?.permissions)
  return checkPermission(permissions, code)
}

export function useHasRole(role: string | string[]): boolean {
  // 性能修复(2026-07-25):只订阅 roleId 字段,避免全 user 订阅。
  const roleId = useAuthStore((s) => s.user?.roleId)
  if (roleId === undefined) return true
  const roles = Array.isArray(role) ? role : [role]
  // admin/superadmin 映射到 roleId >= 1(与后端 ADMIN_ROLE_ID = 1 一致)
  if (roles.includes('admin') || roles.includes('superadmin')) return roleId >= 1
  return false
}
