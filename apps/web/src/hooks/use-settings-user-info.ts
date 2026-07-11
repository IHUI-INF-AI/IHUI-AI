'use client'

import * as React from 'react'

import { useUserStore } from '@/stores/user'
import { updateProfile, bindPhone, type UserProfile } from '@/lib/user-api'
import { useToast } from '@/hooks/use-toast'

export interface UseSettingsUserInfoReturn {
  profile: UserProfile | null
  loading: boolean
  submitting: boolean
  updateUserInfo: (
    input: Partial<Pick<UserProfile, 'nickname' | 'avatar' | 'bio' | 'gender' | 'birthday'>>,
  ) => Promise<boolean>
  bindUserPhone: (phone: string, code: string) => Promise<boolean>
  refresh: () => Promise<void>
}

/** 设置-用户信息 Hook，管理资料编辑与手机绑定 */
export function useSettingsUserInfo(): UseSettingsUserInfoReturn {
  const toast = useToast()
  const profile = useUserStore((s) => s.profile)
  const updateProfileStore = useUserStore((s) => s.updateProfile)
  const fetchProfile = useUserStore((s) => s.fetchProfile)
  const loading = useUserStore((s) => s.loading)
  const [submitting, setSubmitting] = React.useState(false)

  const updateUserInfo = React.useCallback(
    async (
      input: Partial<Pick<UserProfile, 'nickname' | 'avatar' | 'bio' | 'gender' | 'birthday'>>,
    ): Promise<boolean> => {
      setSubmitting(true)
      try {
        const res = await updateProfile(input)
        if (res.success) {
          updateProfileStore(res.data)
          toast.success('资料已更新')
          return true
        }
        toast.error('更新失败', res.error)
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [updateProfileStore, toast],
  )

  const bindUserPhone = React.useCallback(
    async (phone: string, code: string): Promise<boolean> => {
      setSubmitting(true)
      try {
        const res = await bindPhone({ phone, code })
        if (res.success) {
          toast.success('手机号绑定成功')
          await fetchProfile()
          return true
        }
        toast.error('绑定失败', res.error)
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [fetchProfile, toast],
  )

  const refresh = React.useCallback(async () => {
    await fetchProfile()
  }, [fetchProfile])

  return {
    profile,
    loading,
    submitting,
    updateUserInfo,
    bindUserPhone,
    refresh,
  }
}
