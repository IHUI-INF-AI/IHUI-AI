import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface AgentDetail {
  id: string
  name: string
  description: string
  avatar?: string
  uses: number
  rating: number
  category: string
  creator: string
  isFree: boolean
  price: number
}

type Route = RouteProp<RootStackParamList, 'AgentDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PRIMARY = '#10B981'

export function AgentDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<AgentDetail>(`/api/agents/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setAgent(res.data)
      else setError(res.error || t('agentDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error || !agent) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error || t('agentDetail.loadFailed')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>{agent.name}</Text>
        <Text style={styles.category}>{agent.category}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>{t('agentDetail.description')}</Text>
        <Text style={styles.value}>{agent.description || '—'}</Text>
        <Text style={styles.label}>{t('agentDetail.creator')}</Text>
        <Text style={styles.value}>{agent.creator}</Text>
        <Text style={styles.label}>{t('agentDetail.uses')}</Text>
        <Text style={styles.value}>{agent.uses}</Text>
        <Text style={styles.label}>{t('agentDetail.rating')}</Text>
        <Text style={styles.value}>★ {agent.rating.toFixed(1)}</Text>
        <Text style={styles.label}>{t('agentDetail.price')}</Text>
        <Text style={styles.price}>{agent.isFree ? t('agentDetail.free') : `¥${agent.price.toFixed(2)}`}</Text>
      </View>
      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('AgentChat', { agentId: agent.id, name: agent.name })}>
        <Text style={styles.ctaText}>{t('agentDetail.startChat')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  header: { marginTop: 8, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  category: { marginTop: 4, fontSize: 12, color: PRIMARY },
  card: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  label: { marginTop: 8, fontSize: 11, color: '#9ca3af' },
  value: { marginTop: 2, fontSize: 14, color: '#111827' },
  price: { marginTop: 2, fontSize: 18, fontWeight: '600', color: PRIMARY },
  cta: { marginTop: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
