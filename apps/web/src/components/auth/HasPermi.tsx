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
  const user = useAuthStore((s) => s.user)
  const hasPermission = checkPermission(user?.permissions, code)
  if (!hasPermission) return <>{fallback}</>
  return <>{children}</>
}

export function useHasPermi(code: string | string[]): boolean {
  const user = useAuthStore((s) => s.user)
  return checkPermission(user?.permissions, code)
}

export function useHasRole(role: string | string[]): boolean {
  const user = useAuthStore((s) => s.user)
  const roleId = user?.roleId
  if (roleId === undefined) return true
  const roles = Array.isArray(role) ? role : [role]
  // admin/superadmin 映射到 roleId >= 1(与后端 ADMIN_ROLE_ID = 1 一致)
  if (roles.includes('admin') || roles.includes('superadmin')) return roleId >= 1
  return false
}
