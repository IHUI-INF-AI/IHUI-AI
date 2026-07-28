import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'RefundDetail'>
interface Detail { id: string; orderNo: string; amount: number; status: string; reason: string; createdAt: string }

export function RefundDetailScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetchApi<Detail>(`/refund/${id}`)
      if (!r.success) throw new Error()
      setItem(r.data ?? null)
    } catch { setError(t('refundDetail.loadFailed')) } finally { setLoading(false) }
  }, [id, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={s.center}><Loading /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }
  if (error || !item) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('refundDetail.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('refundDetail.title')}</Text>
      </View>
      <View style={s.body}>
        <View style={s.row}><Text style={s.label}>{t('refundDetail.orderNo')}</Text><Text style={s.value}>{item.orderNo}</Text></View>
        <View style={s.row}><Text style={s.label}>{t('refundDetail.amount')}</Text><Text style={s.value}>¥{item.amount.toFixed(2)}</Text></View>
        <View style={s.row}><Text style={s.label}>{t('refundDetail.status')}</Text><Text style={[s.value, { color: tokens.success.DEFAULT }]}>{item.status}</Text></View>
        <View style={s.row}><Text style={s.label}>{t('refundDetail.reason')}</Text><Text style={s.value}>{item.reason}</Text></View>
        <View style={s.row}><Text style={s.label}>{t('refundDetail.createdAt')}</Text><Text style={s.value}>{item.createdAt}</Text></View>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  body: { padding: 16 },
  back: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.surface.card },
  label: { fontSize: 13, color: tokens.text.secondary },
  value: { fontSize: 13, color: tokens.text.primary, fontWeight: '500', flexShrink: 1, marginLeft: 12, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
