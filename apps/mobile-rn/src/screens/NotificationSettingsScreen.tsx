import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface NotificationSettings {
  pushEnabled: boolean
  messageEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  marketingEnabled: boolean
}

export function NotificationSettingsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<NotificationSettings>('/user/notification-settings')
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

  const toggle = (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetchApi<NotificationSettings>('/user/notification-settings', {
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

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !settings) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t('common.empty')}</Text>
      </View>
    )
  }

  const rows: Array<{ key: keyof NotificationSettings; label: string }> = [
    { key: 'pushEnabled', label: t('notificationSettings.push') },
    { key: 'messageEnabled', label: t('notificationSettings.message') },
    { key: 'emailEnabled', label: t('notificationSettings.email') },
    { key: 'smsEnabled', label: t('notificationSettings.sms') },
    { key: 'marketingEnabled', label: t('notificationSettings.marketing') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('notificationSettings.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.desc}>{t('notificationSettings.desc')}</Text>
        </Card>
        <Card style={styles.card}>
          {rows.map((row, idx) => (
            <View key={row.key} style={[styles.row, idx > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{row.label}</Text>
              <Switch
                value={settings[row.key]}
                onValueChange={(v) => toggle(row.key, v)}
                trackColor={{ false: tokens.border.light, true: tokens.brand.DEFAULT }}
              />
            </View>
          ))}
        </Card>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        <Button loading={saving} disabled={saving} onPress={handleSave} style={styles.saveBtn}>
          {saving ? t('notificationSettings.saving') : t('notificationSettings.save')}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  center: { flex: 1, backgroundColor: tokens.surface.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  body: { padding: 16 },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  desc: { fontSize: 12, color: tokens.text.secondary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivider: { borderTopColor: tokens.surface.card, borderTopWidth: 1 },
  label: { fontSize: 13, color: tokens.text.medium },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT, marginBottom: 8 },
  successText: { fontSize: 12, color: tokens.success.DEFAULT, marginBottom: 8 },
  saveBtn: { marginTop: 4, borderRadius: 8, backgroundColor: tokens.success.DEFAULT },
  muted: { fontSize: 13, color: tokens.text.secondary },
})
