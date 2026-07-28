import { useEffect, useState } from 'react'
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { fetchApi } from '@ihui/api-client'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface SecuritySettings {
  passwordEnabled: boolean
  biometricEnabled: boolean
  twoFactorEnabled: boolean
  loginAlert: boolean
}

export function SecuritySettingsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [settings, setSettings] = useState<SecuritySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<SecuritySettings>('/api/user/security')
        if (cancelled) return
        if (!res.success) throw new Error('http')
        setSettings(res.data ?? null)
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

  const toggle = (key: keyof SecuritySettings, value: boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
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

  const rows: Array<{ key: keyof SecuritySettings; label: string }> = [
    { key: 'passwordEnabled', label: t('securitySettings.password') },
    { key: 'biometricEnabled', label: t('securitySettings.biometric') },
    { key: 'twoFactorEnabled', label: t('securitySettings.twoFactor') },
    { key: 'loginAlert', label: t('securitySettings.loginAlert') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('securitySettings.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.desc}>{t('securitySettings.desc')}</Text>
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
  muted: { fontSize: 13, color: '#6B7280' },
  errorText: { fontSize: 13, color: '#DC2626' },
})
