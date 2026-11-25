// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Check, Play } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
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
          <>
            <View style={styles.card}>
              <Text style={styles.desc}>{t('notificationSettings.desc')}</Text>
            </View>

            <View style={styles.card}>
              {CHANNEL_ROWS.map((row) => (
                <View key={row.key} style={styles.row}>
                  <Text style={styles.rowLabel}>{t(row.labelKey)}</Text>
                  <Switch
                    value={Boolean(settings?.[row.key])}
                    onValueChange={(v) => handleChannelToggle(row.key, v)}
                    trackColor={{ true: tokens.brand.cta, false: tokens.surface.muted }}
                  />
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('notificationSettings.soundToggle')}</Text>
                <Switch
                  value={soundEnabledState}
                  onValueChange={(v) => void handleSoundToggle(v)}
                  trackColor={{ true: tokens.brand.cta, false: tokens.surface.muted }}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('notificationSettings.ringtoneTitle')}</Text>
              <Text style={styles.sectionDesc}>{t('notificationSettings.ringtoneDesc')}</Text>
              {RINGTONE_ID_LIST.map((id) => (
                <RingtoneRow
                  key={id}
                  name={t(`notificationSettings.ringtoneNames.${id}`)}
                  selected={ringtoneId === id}
                  onSelect={() => handleSelectRingtone(id)}
                  onPreview={() => handlePreview(id)}
                  previewLabel={t('notificationSettings.ringtonePreview')}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('MessageCenter')}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>{t('messageCenter.title')}</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnText}>
                {saving ? t('notificationSettings.saving') : t('notificationSettings.save')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

interface RingtoneRowProps {
  name: string
  selected: boolean
  previewLabel: string
  onSelect: () => void
  onPreview: () => void
}

/** 单个铃声选项:整行可选中(radio 语义),右侧独立试听按钮;选中态有读屏等价标签。 */
function RingtoneRow({ name, selected, previewLabel, onSelect, onPreview }: RingtoneRowProps) {
  return (
    <TouchableOpacity
      style={styles.ringtoneRow}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      activeOpacity={0.7}
    >
      <Text style={[styles.rowLabel, styles.flexOne]}>{name}</Text>
      <TouchableOpacity
        onPress={onPreview}
        accessibilityRole="button"
        accessibilityLabel={previewLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Play size={18} color={tokens.text.medium} />
      </TouchableOpacity>
      {selected ? <Check size={18} color={tokens.brand.DEFAULT} strokeWidth={3} /> : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.lg, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: rnSpacing['3xl'] },
  card: {
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    gap: rnSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rnSpacing.md,
    gap: rnSpacing.md,
  },
  ringtoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rnSpacing.md,
    gap: rnSpacing.md,
  },
  rowLabel: { ...rnType.body, color: tokens.text.primary },
  flexOne: { flex: 1 },
  desc: { ...rnType.body, color: tokens.text.secondary },
  sectionTitle: { ...rnType.body, fontWeight: '600', color: tokens.text.primary },
  sectionDesc: { fontSize: rnType.label.size, color: tokens.text.medium },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rnSpacing.md,
  },
  errorText: { ...rnType.body, color: tokens.danger.deepText },
  successText: { ...rnType.body, color: tokens.success.deepText },
  retryText: { ...rnType.body, color: tokens.brandAccent.deep, marginTop: rnSpacing.sm },
  saveBtn: {
    marginTop: rnSpacing.sm,
    borderRadius: rnRadius.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brand.cta,
  },
  saveBtnDisabled: { backgroundColor: tokens.text.secondary },
  saveBtnText: { color: tokens.brand.ctaForeground, ...rnType.title },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
