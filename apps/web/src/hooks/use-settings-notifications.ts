'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useToast } from '@/hooks/use-toast'

export interface NotificationSettings {
  system: boolean
  message: boolean
  marketing: boolean
  sound: boolean
  desktop: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  system: true,
  message: true,
  marketing: false,
  sound: true,
  desktop: false,
}

export interface UseSettingsNotificationsReturn {
  settings: NotificationSettings
  loading: boolean
  update: (patch: Partial<NotificationSettings>) => Promise<void>
  reset: () => void
}

/** 设置-通知 Hook，管理通知偏好并同步到后端 */
export function useSettingsNotifications(): UseSettingsNotificationsReturn {
  const toast = useToast()
  const [settings, setSettings] = useLocalStorage<NotificationSettings>(
    'settings-notifications',
    DEFAULT_SETTINGS,
  )
  const [loading, setLoading] = React.useState(false)

  const update = React.useCallback(
    async (patch: Partial<NotificationSettings>) => {
      const next = { ...settings, ...patch }
      setSettings(next)
      setLoading(true)
      try {
        await fetchApi('/user/notification-settings', {
          method: 'PUT',
          body: JSON.stringify(next),
        })
        toast.success('通知设置已保存')
      } finally {
        setLoading(false)
      }
    },
    [settings, setSettings, toast],
  )

  const reset = React.useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    toast.success('已恢复默认通知设置')
  }, [setSettings, toast])

  return { settings, loading, update, reset }
}
