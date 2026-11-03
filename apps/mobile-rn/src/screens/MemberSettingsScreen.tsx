// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { fetchApi, updateNotificationSettings, updatePrivacySettings } from '@ihui/api-client'
import { MemberSettingsScreen as SharedMemberSettingsScreen, type MemberPrefs } from '@ihui/rn-app'
import { apiFailureToText } from '@ihui/shared/utils'

import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端存的是 string|null 的键值表,这里统一折算成 boolean 开关(空/缺省一律 false) */
const toPrefs = (settings: Record<string, string | null> | undefined): MemberPrefs => {
  const out: MemberPrefs = {}
  for (const [k, v] of Object.entries(settings ?? {})) out[k] = v === 'true' || v === '1'
  return out
}

/**
 * 会员偏好设置(mobile-rn 宿主)。
 * 读到的是后端真正在跑的两份:`GET /api/settings/notifications|privacy`(都回 `{settings}`),
 * 写同理。web 的 `member/settings` 页与后端形状不符,故不复用其路由。
 */
export function MemberSettingsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [notifications, setNotifications] = useState<MemberPrefs>({})
  const [privacy, setPrivacy] = useState<MemberPrefs>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    const [n, p] = await Promise.all([
      fetchApi<{ settings?: Record<string, string | null> }>('/api/settings/notifications'),
      fetchApi<{ settings?: Record<string, string | null> }>('/api/settings/privacy'),
    ])
    if (n.success && p.success) {
      setNotifications(toPrefs(n.data?.settings))
      setPrivacy(toPrefs(p.data?.settings))
    } else {
      setError(apiFailureToText(!n.success ? n : p, t('memberSettings.loadFailed')))
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onToggle = useCallback(
    async (group: 'notifications' | 'privacy', key: string, value: boolean) => {
      const prev = group === 'notifications' ? notifications : privacy
      const next = { ...prev, [key]: value }
      // 乐观更新 + 失败回滚:开关是瞬时动作,等服务端往返会看起来卡住
      if (group === 'notifications') setNotifications(next)
      else setPrivacy(next)
      setSaving(true)
      setError('')
      const res =
        group === 'notifications'
          ? await updateNotificationSettings(next)
          : await updatePrivacySettings(next)
      setSaving(false)
      if (!res.success) {
        if (group === 'notifications') setNotifications(prev)
        else setPrivacy(prev)
        setError(apiFailureToText(res, t('memberSettings.saveFailed')))
      }
    },
    [notifications, privacy, t],
  )

  return (
    <SharedMemberSettingsScreen
      t={t}
      notifications={notifications}
      privacy={privacy}
      loading={loading}
      saving={saving}
      error={error}
      onToggle={onToggle}
      onRetry={() => void load()}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
