'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'

export interface UseSettingsDangerReturn {
  loading: boolean
  deleteAccount: (password: string) => Promise<boolean>
  logoutAllDevices: () => Promise<boolean>
  exportData: () => Promise<boolean>
}

/** 设置-危险区 Hook，处理注销账号、登出全部设备、导出数据等高危操作 */
export function useSettingsDanger(): UseSettingsDangerReturn {
  const toast = useToast()
  const logout = useAuthStore((s) => s.logout)
  const [loading, setLoading] = React.useState(false)

  const deleteAccount = React.useCallback(
    async (password: string): Promise<boolean> => {
      setLoading(true)
      try {
        const res = await fetchApi<{ success: boolean }>('/auth/account', {
          method: 'DELETE',
          body: JSON.stringify({ password }),
        })
        if (res.success) {
          toast.success('账号已注销')
          logout()
          return true
        }
        toast.error('注销失败', res.error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [logout, toast],
  )

  const logoutAllDevices = React.useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const res = await fetchApi<{ success: boolean }>('/auth/logout-all', {
        method: 'POST',
      })
      if (res.success) {
        toast.success('已登出全部设备')
        logout()
        return true
      }
      toast.error('操作失败', res.error)
      return false
    } finally {
      setLoading(false)
    }
  }, [logout, toast])

  const exportData = React.useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const res = await fetchApi<{ url: string }>('/auth/export-data', {
        method: 'POST',
      })
      if (!res.success) {
        toast.error('导出失败', res.error)
        return false
      }
      if (!res.data.url) {
        toast.error('导出失败', '未获取到导出链接')
        return false
      }
      if (typeof window !== 'undefined') {
        window.open(res.data.url, '_blank')
      }
      toast.success('数据导出已开始')
      return true
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { loading, deleteAccount, logoutAllDevices, exportData }
}
