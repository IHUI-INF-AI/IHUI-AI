// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnSpacing, rnType } from '@ihui/design-tokens'
import { NotificationSettingsScreen as SharedNotificationSettingsScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import {
  RINGTONE_ID_LIST,
  getStoredRingtoneIdSync,
  hydrateRingtoneSettings,
  isSoundEnabled,
  previewRingtone,
  setSoundEnabled as persistSoundEnabled,
  setStoredRingtoneId as persistRingtoneId,
  type RingtoneId,
} from '../lib/notification-ringtone'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端 notifications 偏好键值记录(任意 string 键,GET 整体返回)。 */
type NotificationSettingsMap = Record<string, unknown>

interface ChannelRow {
  key: string
  labelKey: string
}

/** 渠道开关行(与原共享屏 items 同口径)。 */
const CHANNEL_ROWS: ChannelRow[] = [
  { key: 'pushEnabled', labelKey: 'notificationSettings.push' },
  { key: 'messageEnabled', labelKey: 'notificationSettings.message' },
  { key: 'emailEnabled', labelKey: 'settings.emailNotif' },
  { key: 'smsEnabled', labelKey: 'settings.smsNotif' },
  { key: 'marketingEnabled', labelKey: 'notificationSettings.marketing' },
]

export function NotificationSettingsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [settings, setSettings] = useState<NotificationSettingsMap | null>(null)
  const [soundEnabledState, setSoundEnabledState] = useState(true)
  const [ringtoneId, setRingtoneId] = useState<RingtoneId>(getStoredRingtoneIdSync())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((key) => key + 1)

  // 进页面先回源本地缓存,再以服务端值校正;服务端缺键时保留本地/默认。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      try {
        await hydrateRingtoneSettings()
        const res = await fetchApi<{ settings?: NotificationSettingsMap }>(
          '/settings/notifications',
        )
        if (cancelled) return
        if (!res.success) {
          setError(res.error || t('notificationSettings.loadFailed'))
          return
        }
        const raw = res.data?.settings ?? {}
        setSettings(raw)
        const serverRingtone = typeof raw.ringtone === 'string' ? raw.ringtone : null
        if (serverRingtone !== null) persistRingtoneId(serverRingtone)
        setRingtoneId(getStoredRingtoneIdSync())
        const serverSound = raw.soundEnabled
        const soundOn =
          typeof serverSound === 'string'
            ? serverSound !== '0' && serverSound !== 'false'
            : isSoundEnabled()
        persistSoundEnabled(soundOn)
        setSoundEnabledState(soundOn)
      } catch {
        if (!cancelled) setError(t('notificationSettings.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t, reloadKey])

  const handleChannelToggle = useCallback((key: string, value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  // 提示音开关:本地镜像先改(关闭立即静音,不等刷新),再同步后端;后端失败回滚本地。
  const handleSoundToggle = useCallback(
    async (next: boolean) => {
      const prev = soundEnabledState
      setSoundEnabledState(next)
      persistSoundEnabled(next)
      try {
        const res = await fetchApi('/settings/notifications', {
          method: 'PUT',
          body: JSON.stringify({ soundEnabled: next ? 'true' : 'false' }),
        })
        if (!res.success) throw new Error(res.error)
      } catch {
        setSoundEnabledState(prev)
        persistSoundEnabled(prev)
      }
    },
    [soundEnabledState],
  )

  // 选中铃声:本地立即生效,再同步后端;后端失败不回滚本地(下次保存整体落库)。
  const handleSelectRingtone = useCallback((id: RingtoneId) => {
    setRingtoneId(id)
    persistRingtoneId(id)
    void fetchApi('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({ ringtone: id }),
    }).catch(() => {})
  }, [])

  const handlePreview = useCallback((id: RingtoneId) => {
    previewRingtone(id)
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetchApi('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({
          ...settings,
          soundEnabled: soundEnabledState ? 'true' : 'false',
          ringtone: ringtoneId,
        }),
      })
      if (!res.success) {
        setError(res.error || t('notificationSettings.saveFailed'))
        return
      }
      setSuccess(t('notificationSettings.saved'))
    } catch {
      setError(t('notificationSettings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // UI 已整体下沉到 @ihui/rn-app 共享屏(与小程序端同一份渲染)。
  // 本壳只保留四处:①导航条 ②loading/error 宿主惯例 ③取数/持久化/响铃 lib ④端侧文案注入。
  const items = CHANNEL_ROWS.map((row) => ({
    key: row.key,
    label: t(row.labelKey),
    enabled: Boolean(settings?.[row.key]),
  }))
  const ringtoneNames = Object.fromEntries(
    RINGTONE_ID_LIST.map((id) => [id, t(`notificationSettings.ringtoneNames.${id}`)]),
  )

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('notificationSettings')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={tokens.brandAccent.deep} />
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={reload} activeOpacity={0.7}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SharedNotificationSettingsScreen
            t={t}
            items={items}
            onToggle={handleChannelToggle}
            onSave={() => void handleSave()}
            onBack={() => navigation.goBack()}
            loading={false}
            saving={saving}
            error=""
            success={success}
            showHeader={false}
            colorScheme={resolvedTheme}
            extraLinks={[
              {
                key: 'message-center',
                label: t('messageCenter.title'),
                onPress: () => navigation.navigate('MessageCenter'),
              },
            ]}
            ringtone={{
              soundEnabled: soundEnabledState,
              soundToggleLabel: t('notificationSettings.soundToggle'),
              ringtoneId,
              ringtoneIds: RINGTONE_ID_LIST,
              ringtoneNames,
              title: t('notificationSettings.ringtoneTitle'),
              desc: t('notificationSettings.ringtoneDesc'),
              previewLabel: t('notificationSettings.ringtonePreview'),
              onToggleSound: (v) => void handleSoundToggle(v),
              onSelectRingtone: (id) => handleSelectRingtone(id as RingtoneId),
              onPreviewRingtone: (id) => handlePreview(id as RingtoneId),
            }}
          />
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.lg, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: rnSpacing['3xl'] },
  errorText: { ...rnType.body, color: tokens.danger.deepText },
  retryText: { ...rnType.body, color: tokens.brandAccent.deep, marginTop: rnSpacing.sm },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
