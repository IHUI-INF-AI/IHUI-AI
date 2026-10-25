// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 开发者设置页(mobile-rn 端)—— 薄壳,复用通用开关偏好屏 SwitchPrefsScreen。
 * 端点(与 web developer/settings 同源):GET /api/developer/settings ⇒ { info?, preferences? };
 * PUT { preferences } ⇒ 保存偏好。首版承载两个 boolean 偏好(sandboxAutoRun/errorReport),
 * defaultVersion 单选与 info 资料编辑留后续通用屏扩展(选择行/表单形态)。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { SwitchPrefsScreen, type SwitchPrefItem } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface DevPreferences {
  defaultVersion: string
  sandboxAutoRun: boolean
  errorReport: boolean
}

interface DevSettings {
  info?: { name: string; email: string; company?: string; website?: string }
  preferences?: DevPreferences
}

const DEFAULT_PREFS: DevPreferences = {
  defaultVersion: 'v1',
  sandboxAutoRun: false,
  errorReport: true,
}

export function DeveloperSettingsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [prefs, setPrefs] = useState<DevPreferences>(DEFAULT_PREFS)
  const [values, setValues] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<DevSettings>('/api/developer/settings')
      if (!res.success) throw new Error(res.error || 'load failed')
      const p = { ...DEFAULT_PREFS, ...(res.data?.preferences ?? {}) }
      setPrefs(p)
      setValues({ sandboxAutoRun: p.sandboxAutoRun, errorReport: p.errorReport })
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
      const prevValues = values
      const nextValues = { ...values, [key]: next }
      setValues(nextValues)
      setPendingKey(key)
      try {
        const res = await fetchApi('/api/developer/settings', {
          method: 'PUT',
          body: JSON.stringify({ preferences: { ...prefs, [key]: next } }),
        })
        if (!res.success) throw new Error(res.error)
        setPrefs((p) => ({ ...p, [key]: next }))
      } catch (e) {
        setValues(prevValues)
        void appAlert(
          t('common.error'),
          e instanceof Error ? e.message : t('developerSettings.title'),
        )
      } finally {
        setPendingKey(null)
      }
    },
    [values, prefs, t],
  )

  const items: SwitchPrefItem[] = [
    {
      key: 'sandboxAutoRun',
      label: t('developerSettings.sandboxAutoRun'),
      desc: t('developerSettings.sandboxAutoRunDesc'),
    },
    {
      key: 'errorReport',
      label: t('developerSettings.errorReport'),
      desc: t('developerSettings.errorReportDesc'),
    },
  ]

  return (
    <SwitchPrefsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('developerSettings.title')}
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

export default DeveloperSettingsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
