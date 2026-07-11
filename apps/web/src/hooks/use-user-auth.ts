'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

export interface UseUserAuthReturn {
  isAuthenticated: boolean
  user: ReturnType<typeof useAuthStore.getState>['user']
  profile: ReturnType<typeof useUserStore.getState>['profile']
  isReady: boolean
  logout: () => void
}

/** 用户认证 Hook，聚合 auth store 与 user store，提供统一认证视图 */
export function useUserAuth(): UseUserAuthReturn {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const profile = useUserStore((s) => s.profile)
  const logout = useAuthStore((s) => s.logout)
  const fetchProfile = useUserStore((s) => s.fetchProfile)

  // 已认证但未拉取过 profile 时自动拉取
  React.useEffect(() => {
    if (isAuthenticated && !profile) {
      fetchProfile()
    }
  }, [isAuthenticated, profile, fetchProfile])

  const isReady = !isAuthenticated || !!profile

  return { isAuthenticated, user, profile, isReady, logout }
}
