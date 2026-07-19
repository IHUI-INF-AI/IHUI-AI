import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface CompareRow { feature: string; basic: string; premium: string; enterprise: string }

export function VipCompareScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [rows, setRows] = useState<CompareRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/vip-compare`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: CompareRow[] }
      setRows(d.data ?? [])
    } catch { setError(t('vipCompare.loadFailed')) } finally { setLoading(false) }
  }, [token, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }
  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }
  if (rows.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>{t('common.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('vipCompare.title')}</Text>
      </View>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.cell, s.cellFeature]}>{t('vipCompare.feature')}</Text>
          <Text style={s.cell}>{t('vipCompare.basic')}</Text>
          <Text style={s.cell}>{t('vipCompare.premium')}</Text>
          <Text style={s.cell}>{t('vipCompare.enterprise')}</Text>
        </View>
        {rows.map((row, idx) => (
          <View key={idx} style={[s.tableRow, idx % 2 === 1 && s.rowAlt]}>
            <Text style={[s.cell, s.cellFeature, s.cellText]}>{row.feature}</Text>
            <Text style={[s.cell, s.cellText]}>{row.basic}</Text>
            <Text style={[s.cell, s.cellText]}>{row.premium}</Text>
            <Text style={[s.cell, s.cellText]}>{row.enterprise}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  back: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  table: { margin: 16, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F9FAFB' },
  tableRow: { flexDirection: 'row' },
  rowAlt: { backgroundColor: '#F9FAFB' },
  cell: { flex: 1, padding: 10, fontSize: 11, color: '#6B7280' },
  cellFeature: { flex: 1.2, fontWeight: '600', color: '#111827' },
  cellText: { fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  error: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
