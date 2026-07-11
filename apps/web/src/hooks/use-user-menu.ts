'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'

export interface UserMenuItem {
  key: string
  label: string
  icon?: string
  href?: string
  badge?: number
  danger?: boolean
  onClick?: () => void
}

export interface UseUserMenuReturn {
  items: UserMenuItem[]
  open: boolean
  setOpen: (open: boolean) => void
}

/** 用户菜单 Hook，根据登录态构造用户下拉菜单项 */
export function useUserMenu(): UseUserMenuReturn {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [open, setOpen] = React.useState(false)

  const items = React.useMemo<UserMenuItem[]>(() => {
    if (!isAuthenticated) {
      return [
        { key: 'login', label: '登录', href: '/login' },
        { key: 'register', label: '注册', href: '/register' },
      ]
    }
    return [
      { key: 'profile', label: '个人中心', href: '/user/profile' },
      { key: 'orders', label: '我的订单', href: '/user/orders' },
      { key: 'favorites', label: '我的收藏', href: '/user/favorites' },
      { key: 'settings', label: '设置', href: '/settings' },
      { key: 'logout', label: '退出登录', danger: true },
    ]
  }, [isAuthenticated])

  return { items, open, setOpen }
}
