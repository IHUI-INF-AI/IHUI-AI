import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Stat {
  conversations: number
  messages: number
  tokens: number
  avgRating: number
}

export function AgentStatScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [stat, setStat] = useState<Stat | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Stat>('/agent-stat')
      if (!res.success) throw new Error()
      setStat(res.data ?? null)
    } catch {
      setError(t('agentStat.loadFailed'))
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
        <ActivityIndicator />
        <Text style={s.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !stat) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('common.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const metrics: Array<[string, string | number]> = [
    [t('agentStat.conversations'), stat.conversations],
    [t('agentStat.messages'), stat.messages],
    [t('agentStat.tokens'), stat.tokens],
    [t('agentStat.avgRating'), stat.avgRating.toFixed(2)],
  ]

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('agentStat.title')}</Text>
      </View>
      <View style={s.body}>
        {metrics.map(([label, value]) => (
          <View key={label} style={s.row}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.value}>{value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.light },
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.surface.card,
  },
  label: { fontSize: 13, color: tokens.text.secondary },
  value: { fontSize: 15, fontWeight: '600', color: tokens.brand.DEFAULT },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  error: { fontSize: 13, color: tokens.error.text, textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
