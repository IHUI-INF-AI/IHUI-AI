// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 开发者通知偏好页(mobile-rn 端)—— 薄壳,复用通用开关偏好屏
 * `packages/app/src/features/switch-prefs/SwitchPrefsScreen.tsx`(开关型设置页杠杆首例)。
 * 端点:GET/PUT /api/developer/notifications ⇒ NotificationPrefs(六 boolean,web 基准同源)。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { SwitchPrefsScreen, type SwitchPrefItem } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

// type 别名(非 interface):具隐式索引签名,可直接喂给 Record<string, boolean> 乐观态
type NotificationPrefs = {
  apiError: boolean
  quotaWarning: boolean
  webhookFailure: boolean
  weeklyReport: boolean
  versionUpdate: boolean
  billingReminder: boolean
}

export function DeveloperNotificationsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [values, setValues] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<NotificationPrefs>('/api/developer/notifications')
      if (!res.success || !res.data) throw new Error(res.error || 'load failed')
      setValues(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onToggle = useCallback(
    async (key: string, next: boolean) => {
      setPendingKey(key)
      const optimistic = { ...values, [key]: next }
      setValues(optimistic)
      try {
        const res = await fetchApi('/api/developer/notifications', {
          method: 'PUT',
          body: JSON.stringify(optimistic),
        })
        if (!res.success) throw new Error(res.error)
      } catch (e) {
        setValues(values) // 回滚
        void appAlert(
          t('common.error'),
          e instanceof Error ? e.message : t('developerNotifications.title'),
        )
      } finally {
        setPendingKey(null)
      }
    },
    [values, t],
  )

  const items: SwitchPrefItem[] = [
    { key: 'apiError', label: t('developerNotifications.apiError') },
    { key: 'quotaWarning', label: t('developerNotifications.quotaWarning') },
    { key: 'webhookFailure', label: t('developerNotifications.webhookFailure') },
    { key: 'weeklyReport', label: t('developerNotifications.weeklyReport') },
    { key: 'versionUpdate', label: t('developerNotifications.versionUpdate') },
    { key: 'billingReminder', label: t('developerNotifications.billingReminder') },
  ]

  return (
    <SwitchPrefsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('developerNotifications.title')}
      items={items}
      values={values}
      loading={loading}
      error={error}
      pendingKey={pendingKey}
      onToggle={(k, v) => void onToggle(k, v)}
      onRetry={() => void load()}
    />
  )
}

export default DeveloperNotificationsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
