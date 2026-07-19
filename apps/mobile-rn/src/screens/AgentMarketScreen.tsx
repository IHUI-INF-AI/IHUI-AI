import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Agent { id: string; name: string; description: string; category: string; uses: number; rating: number; isFree: boolean }

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PRIMARY = '#10B981'

export function AgentMarketScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = async (kw: string) => {
    setLoading(true)
    setError('')
    const url = kw ? `/api/agents?keyword=${encodeURIComponent(kw)}` : '/api/agents'
    const res = await fetchApi<Agent[]>(url)
    if (res.success) setAgents(res.data ?? [])
    else if (!res.success) setError(res.error || t('agentMarket.loadFailed'))
    setLoading(false)
  }

  useEffect(() => { void load('') }, [])

  if (loading && agents.length === 0) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error && agents.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('agentMarket.title')}</Text>
      <View style={styles.searchRow}>
        <TextInput style={styles.input} value={keyword} onChangeText={setKeyword} placeholder={t('agentMarket.searchPlaceholder')} placeholderTextColor="#9ca3af" onSubmitEditing={() => load(keyword)} returnKeyType="search" />
        <TouchableOpacity style={styles.searchBtn} onPress={() => load(keyword)}><Text style={styles.searchText}>{t('common.search')}</Text></TouchableOpacity>
      </View>
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('agentMarket.empty')}</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AgentDetail', { id: item.id })}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.row}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.meta}>★ {item.rating.toFixed(1)} · {item.uses}{t('agentMarket.uses')}</Text>
              <Text style={styles.price}>{item.isFree ? t('agentMarket.free') : t('agentMarket.paid')}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827' },
  searchBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  searchText: { color: '#fff', fontSize: 14 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  desc: { marginTop: 4, fontSize: 13, color: '#374151' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  category: { fontSize: 11, color: PRIMARY, backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  meta: { fontSize: 11, color: '#9ca3af' },
  price: { marginLeft: 'auto', fontSize: 12, fontWeight: '600', color: PRIMARY },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
