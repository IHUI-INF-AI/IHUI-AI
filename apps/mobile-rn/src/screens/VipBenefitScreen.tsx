import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Badge, Loading } from '@ihui/ui-native'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Benefit {
  id: string
  name: string
  desc: string
  level: string
}

export function VipBenefitScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetchApi<Benefit[]>('/vip-benefit')
      if (!r.success) throw new Error()
      setItems(r.data ?? [])
    } catch {
      setError(t('vipBenefit.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <View style={s.center}>
        <Loading />
        <Text style={s.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }
  if (items.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>{t('common.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('vipBenefit.title')}</Text>
      </View>
      <View style={s.body}>
        {items.map((item) => (
          <View key={item.id} style={s.card}>
            <View style={s.titleRow}>
              <Text style={s.cardTitle}>{item.name}</Text>
              <Badge variant="default" label={item.level} />
            </View>
            <Text style={s.cardDesc}>{item.desc}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  body: { padding: 16 },
  back: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, marginBottom: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  cardDesc: { marginTop: 6, fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
