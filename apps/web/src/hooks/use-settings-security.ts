'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { updatePassword } from '@/lib/user-api'
import { useToast } from '@/hooks/use-toast'

export interface SecurityInfo {
  twoFactorEnabled: boolean
  passwordSetAt: string | null
  lastLoginAt: string | null
  lastLoginIp: string | null
  loginDevices: number
}

export interface UseSettingsSecurityReturn {
  security: SecurityInfo | null
  loading: boolean
  submitting: boolean
  fetchSecurity: () => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>
  toggleTwoFactor: (enable: boolean) => Promise<boolean>
}

const DEFAULT_SECURITY: SecurityInfo = {
  twoFactorEnabled: false,
  passwordSetAt: null,
  lastLoginAt: null,
  lastLoginIp: null,
  loginDevices: 0,
}

/** 设置-安全 Hook，管理密码修改与两步验证 */
export function useSettingsSecurity(): UseSettingsSecurityReturn {
  const toast = useToast()
  const [security, setSecurity] = React.useState<SecurityInfo | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const fetchSecurity = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<SecurityInfo>('/user/security')
      if (res.success) {
        setSecurity(res.data)
      } else {
        setSecurity(DEFAULT_SECURITY)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const changePassword = React.useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      setSubmitting(true)
      try {
        const res = await updatePassword({ oldPassword, newPassword })
        if (res.success) {
          toast.success('密码修改成功')
          return true
        }
        toast.error('密码修改失败', res.error)
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [toast],
  )

  const toggleTwoFactor = React.useCallback(
    async (enable: boolean): Promise<boolean> => {
      setSubmitting(true)
      try {
        const res = await fetchApi<{ success: boolean }>('/user/two-factor', {
          method: 'PUT',
          body: JSON.stringify({ enable }),
        })
        if (res.success) {
          setSecurity((s) => (s ? { ...s, twoFactorEnabled: enable } : s))
          toast.success(enable ? '两步验证已开启' : '两步验证已关闭')
          return true
        }
        toast.error('操作失败', res.error)
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [toast],
  )

  return {
    security,
    loading,
    submitting,
    fetchSecurity,
    changePassword,
    toggleTwoFactor,
  }
}
