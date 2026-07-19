import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Stat { conversations: number; messages: number; tokens: number; avgRating: number }

export function AgentStatScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [stat, setStat] = useState<Stat | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/agent-stat`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Stat }
      setStat(d.data ?? null)
    } catch { setError(t('agentStat.loadFailed')) } finally { setLoading(false) }
  }, [token, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }
  if (error || !stat) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('common.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
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
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  body: { padding: 16 },
  back: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  label: { fontSize: 13, color: '#6B7280' },
  value: { fontSize: 15, fontWeight: '600', color: '#10B981' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  error: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
