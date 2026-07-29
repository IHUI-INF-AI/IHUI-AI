import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  SecuritySettingsScreen as SharedSecuritySettingsScreen,
  type SecuritySettingsItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function SecuritySettingsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [settings, setSettings] = useState<SecuritySettingsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetchApi<SecuritySettingsItem>('/user/security')
        if (cancelled) return
        if (!resp.success) throw new Error('http')
        setSettings(resp.data ?? null)
      } catch {
        if (!cancelled) setError(t('securitySettings.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleToggle = useCallback(
    (key: keyof SecuritySettingsItem, value: boolean) => {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    },
    [],
  )

  return (
    <SharedSecuritySettingsScreen
      t={t}
      settings={settings}
      loading={loading}
      error={error}
      onToggle={handleToggle}
      onBack={() => navigation.goBack()}
    />
  )
}
