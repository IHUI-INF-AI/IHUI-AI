import { useEffect, useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

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
        const resp = await fetch(`${API_BASE_URL}/api/customer-service/info`)
        if (!resp.ok) throw new Error('http')
        const data = (await resp.json()) as { data?: CustomerServiceInfo }
        if (cancelled) return
        setInfo(data.data ?? null)
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16 },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, color: '#6B7280' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: '#10B981' },
  dotOffline: { backgroundColor: '#9CA3AF' },
  statusText: { fontSize: 13, fontWeight: '600' },
  textOnline: { color: '#10B981' },
  textOffline: { color: '#9CA3AF' },
  workHours: { marginTop: 8, fontSize: 12, color: '#9CA3AF' },
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivider: { borderTopColor: '#F3F4F6', borderTopWidth: 1 },
  value: { fontSize: 13, color: '#111827' },
  muted: { fontSize: 13, color: '#6B7280' },
  errorText: { fontSize: 13, color: '#DC2626' },
})
