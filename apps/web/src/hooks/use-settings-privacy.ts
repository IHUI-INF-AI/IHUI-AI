'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useToast } from '@/hooks/use-toast'

export interface PrivacySettings {
  profileVisible: boolean
  showOnlineStatus: boolean
  allowSearch: boolean
  showStatistics: boolean
}

const DEFAULT_SETTINGS: PrivacySettings = {
  profileVisible: true,
  showOnlineStatus: true,
  allowSearch: true,
  showStatistics: false,
}

export interface UseSettingsPrivacyReturn {
  settings: PrivacySettings
  loading: boolean
  update: (patch: Partial<PrivacySettings>) => Promise<void>
  reset: () => void
}

/** 设置-隐私 Hook，管理隐私可见性设置 */
export function useSettingsPrivacy(): UseSettingsPrivacyReturn {
  const toast = useToast()
  const [settings, setSettings] = useLocalStorage<PrivacySettings>(
    'settings-privacy',
    DEFAULT_SETTINGS,
  )
  const [loading, setLoading] = React.useState(false)

  const update = React.useCallback(
    async (patch: Partial<PrivacySettings>) => {
      const next = { ...settings, ...patch }
      setSettings(next)
      setLoading(true)
      try {
        await fetchApi('/user/privacy-settings', {
          method: 'PUT',
          body: JSON.stringify(next),
        })
        toast.success('隐私设置已保存')
      } finally {
        setLoading(false)
      }
    },
    [settings, setSettings, toast],
  )

  const reset = React.useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    toast.success('已恢复默认隐私设置')
  }, [setSettings, toast])

  return { settings, loading, update, reset }
}
