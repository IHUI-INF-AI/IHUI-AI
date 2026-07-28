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
type Route = RouteProp<RootStackParamList, 'VipLevel'>
interface Detail { id: string; levelName: string; price: number; durationDays: number; benefits: string }

export function VipLevelScreen() {
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
      const r = await fetchApi<Detail>(`/vip-level/${id}`)
      if (!r.success) throw new Error()
      setItem(r.data ?? null)
    } catch { setError(t('vipLevel.loadFailed')) } finally { setLoading(false) }
  }, [id, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={s.center}><Loading /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }
  if (error || !item) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('vipLevel.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('vipLevel.title')}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.levelName}>{item.levelName}</Text>
        <View style={s.row}><Text style={s.label}>{t('vipLevel.price')}</Text><Text style={s.price}>¥{item.price.toFixed(2)}</Text></View>
        <View style={s.row}><Text style={s.label}>{t('vipLevel.duration')}</Text><Text style={s.value}>{item.durationDays} {t('vipLevel.days')}</Text></View>
        <Text style={s.benefitsTitle}>{t('vipLevel.benefits')}</Text>
        <Text style={s.benefits}>{item.benefits}</Text>
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
  levelName: { fontSize: 22, fontWeight: '700', color: tokens.success.DEFAULT },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.surface.card },
  label: { fontSize: 13, color: tokens.text.secondary },
  price: { fontSize: 18, fontWeight: '600', color: tokens.danger.DEFAULT },
  value: { fontSize: 13, color: tokens.text.primary, fontWeight: '500' },
  benefitsTitle: { marginTop: 16, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  benefits: { marginTop: 6, fontSize: 13, color: tokens.text.medium, lineHeight: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
