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
      const res = await fetchApi<NotificationSettings>('/api/user/notification-settings')
      if (cancelled) return
      if (res.success) setSettings(res.data ?? null)
      else setError(t('notificationSettings.loadFailed'))
      setLoading(false)
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
    const res = await fetchApi<void>('/api/user/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
    if (res.success) setSuccess(t('notificationSettings.saved'))
    else setError(t('notificationSettings.saveFailed'))
    setSaving(false)
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
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16 },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  desc: { fontSize: 12, color: '#6B7280' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivider: { borderTopColor: '#F3F4F6', borderTopWidth: 1 },
  label: { fontSize: 13, color: '#374151' },
  errorText: { fontSize: 12, color: '#DC2626', marginBottom: 8 },
  successText: { fontSize: 12, color: '#10B981', marginBottom: 8 },
  saveBtn: { marginTop: 4, borderRadius: 8, backgroundColor: '#10B981' },
  muted: { fontSize: 13, color: '#6B7280' },
})
