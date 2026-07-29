import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  NotificationSettingsScreen as SharedNotificationSettingsScreen,
  type NotificationSettingsItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function NotificationSettingsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [settings, setSettings] = useState<NotificationSettingsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<NotificationSettingsItem>('/user/notification-settings')
        if (!res.success) throw new Error('http')
        if (cancelled) return
        setSettings(res.data ?? null)
      } catch {
        if (!cancelled) setError(t('notificationSettings.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleToggle = useCallback(
    (key: keyof NotificationSettingsItem, value: boolean) => {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    },
    [],
  )

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetchApi<NotificationSettingsItem>('/user/notification-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      if (!res.success) throw new Error('http')
      setSuccess(t('notificationSettings.saved'))
    } catch {
      setError(t('notificationSettings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SharedNotificationSettingsScreen
      t={t}
      settings={settings}
      loading={loading}
      saving={saving}
      error={error}
      success={success}
      onToggle={handleToggle}
      onSave={handleSave}
      onBack={() => navigation.goBack()}
    />
  )
}
