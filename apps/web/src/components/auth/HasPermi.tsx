'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'

export interface HasPermiProps {
  code: string | string[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

function checkPermission(userPermissions: string[] | undefined, code: string | string[]): boolean {
  if (!userPermissions || userPermissions.length === 0) return true
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
  const userRoles = user?.roles
  if (!userRoles || userRoles.length === 0) return true
  if (userRoles.includes('admin') || userRoles.includes('superadmin')) return true
  const roles = Array.isArray(role) ? role : [role]
  return roles.some((r) => userRoles.includes(r))
}
