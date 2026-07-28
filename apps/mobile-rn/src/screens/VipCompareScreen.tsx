import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type Nav = NativeStackNavigationProp<RootStackParamList>
interface CompareRow { feature: string; basic: string; premium: string; enterprise: string }

export function VipCompareScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [rows, setRows] = useState<CompareRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetchApi<CompareRow[]>('/vip-compare')
      if (!r.success) throw new Error()
      setRows(r.data ?? [])
    } catch { setError(t('vipCompare.loadFailed')) } finally { setLoading(false) }
  }, [t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={s.center}><Loading /><Text style={s.muted}>{t('common.loading')}</Text></View>
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
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  back: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  table: { margin: 16, borderWidth: 1, borderColor: tokens.border.light, borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: tokens.surface.muted },
  tableRow: { flexDirection: 'row' },
  rowAlt: { backgroundColor: tokens.surface.muted },
  cell: { flex: 1, padding: 10, fontSize: 11, color: tokens.text.secondary },
  cellFeature: { flex: 1.2, fontWeight: '600', color: tokens.text.primary },
  cellText: { fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
