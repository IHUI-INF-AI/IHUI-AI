import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { fetchApi } from '@ihui/api-client'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface CustomerServiceInfo {
  online: boolean
  phone: string
  email: string
  workingHours: string
  working: boolean
}

export function CustomerServiceScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<CustomerServiceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<CustomerServiceInfo>('/customer-service/info')
        if (!res.success) throw new Error('http')
        if (cancelled) return
        setInfo(res.data ?? null)
      } catch {
        if (!cancelled) setError(t('customerService.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t('customerService.empty')}</Text>
      </View>
    )
  }

  const onCall = () => {
    if (info.phone) void Linking.openURL(`tel:${info.phone}`)
  }
  const onEmail = () => {
    if (info.email) void Linking.openURL(`mailto:${info.email}`)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('customerService.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{t('customerService.status')}</Text>
            <View style={[styles.dot, info.online ? styles.dotOnline : styles.dotOffline]} />
            <Text style={[styles.statusText, info.online ? styles.textOnline : styles.textOffline]}>
              {info.online ? t('customerService.online') : t('customerService.offline')}
            </Text>
          </View>
          <Text style={styles.workHours}>{t('customerService.workingHours')}: {info.workingHours}</Text>
        </Card>
        <Card style={styles.card}>
          <TouchableOpacity style={styles.contactRow} onPress={onCall}>
            <Text style={styles.label}>{t('customerService.phone')}</Text>
            <Text style={styles.value}>{info.phone || '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactRow, styles.rowDivider]} onPress={onEmail}>
            <Text style={styles.label}>{t('customerService.email')}</Text>
            <Text style={styles.value}>{info.email || '—'}</Text>
          </TouchableOpacity>
        </Card>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, color: tokens.text.secondary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: tokens.success.DEFAULT },
  dotOffline: { backgroundColor: tokens.text.tertiary },
  statusText: { fontSize: 13, fontWeight: '600' },
  textOnline: { color: tokens.success.DEFAULT },
  textOffline: { color: tokens.text.tertiary },
  workHours: { marginTop: 8, fontSize: 12, color: tokens.text.tertiary },
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivider: { borderTopColor: tokens.surface.card, borderTopWidth: 1 },
  value: { fontSize: 13, color: tokens.text.primary },
  muted: { fontSize: 13, color: tokens.text.secondary },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
})
