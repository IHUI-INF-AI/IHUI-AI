import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface FinanceSummary {
  balance: number
  todayIncome: number
  totalIncome: number
  totalExpense: number
}

function formatMoney(n: number | undefined | null): string {
  if (typeof n !== 'number') return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function FinanceScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${API_BASE_URL}/api/wallet/balance`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!resp.ok) throw new Error('http')
        const data = (await resp.json()) as { data?: FinanceSummary }
        if (cancelled) return
        setSummary(data.data ?? null)
      } catch {
        if (!cancelled) setError(t('finance.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.link}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }
  if (!summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('finance.empty')}</Text>
      </View>
    )
  }

  const cards: Array<{ label: string; value: number; primary?: boolean }> = [
    { label: t('finance.balance'), value: summary.balance, primary: true },
    { label: t('finance.todayIncome'), value: summary.todayIncome },
    { label: t('finance.totalIncome'), value: summary.totalIncome },
    { label: t('finance.totalExpense'), value: summary.totalExpense },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('finance.title')}</Text>
      </View>
      {cards.map((c) => (
        <Card key={c.label} style={styles.card}>
          <Text style={styles.label}>{c.label}</Text>
          <Text style={[styles.value, c.primary && styles.valuePrimary]}>¥ {formatMoney(c.value)}</Text>
        </Card>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, gap: 12 },
  backBtn: { marginTop: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  label: { fontSize: 12, color: '#6B7280' },
  value: { marginTop: 4, fontSize: 22, fontWeight: '600', color: '#111827' },
  valuePrimary: { color: '#10B981' },
  muted: { fontSize: 13, color: '#6B7280' },
  errorText: { fontSize: 13, color: '#DC2626', marginBottom: 8 },
  link: { fontSize: 13, color: '#10B981' },
})
