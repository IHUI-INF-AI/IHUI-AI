'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'
import { fetchApi } from '@/lib/api'

export interface TourPermission {
  canView: boolean
  canBook: boolean
  canComment: boolean
  canManage: boolean
  reasons: string[]
}

export interface UseTourPermissionsReturn {
  permission: TourPermission | null
  loading: boolean
  check: (spotId?: string) => Promise<void>
}

const DEFAULT_PERMISSION: TourPermission = {
  canView: true,
  canBook: false,
  canComment: false,
  canManage: false,
  reasons: [],
}

/** 旅游权限 Hook，基于登录态与后端权限接口判断可用操作 */
export function useTourPermissions(): UseTourPermissionsReturn {
  const [permission, setPermission] = React.useState<TourPermission | null>(null)
  const [loading, setLoading] = React.useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const roleId = useAuthStore((s) => s.user?.roleId)

  const check = React.useCallback(
    async (spotId?: string) => {
      setLoading(true)
      try {
        if (!isAuthenticated) {
          setPermission({
            ...DEFAULT_PERMISSION,
            reasons: ['未登录'],
          })
          return
        }
        const url = spotId ? `/api/tour/permissions?spotId=${spotId}` : '/api/tour/permissions'
        const res = await fetchApi<TourPermission>(url)
        if (res.success) {
          setPermission(res.data)
        } else {
          setPermission({
            ...DEFAULT_PERMISSION,
            canBook: true,
            canComment: true,
            canManage: (roleId ?? 0) >= 1,
          })
        }
      } finally {
        setLoading(false)
      }
    },
    [isAuthenticated, roleId],
  )

  return { permission, loading, check }
}
