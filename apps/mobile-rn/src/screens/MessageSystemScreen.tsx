import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Item { id: string; title: string; content: string; time: string; read: boolean }

export function MessageSystemScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/messages/system-notice/list`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Item[] }
      setItems(d.data ?? [])
    } catch { setError(t('messageSystem.loadFailed')) } finally { setLoading(false); setRefreshing(false) }
  }, [token, t])

  useEffect(() => { void load() }, [load])

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('messageSystem.title')}</Text>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>{t('messageSystem.empty')}</Text></View>}
          renderItem={({ item }) => (
            <View style={[s.card, !item.read && s.cardUnread]}>
              <View style={s.titleRow}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                {!item.read ? <View style={s.dot} /> : null}
              </View>
              <Text style={s.cardContent} numberOfLines={2}>{item.content}</Text>
              <Text style={s.cardTime}>{item.time}</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  back: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  error: { paddingHorizontal: 16, fontSize: 12, color: '#DC2626' },
  center: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  cardUnread: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginLeft: 8 },
  cardContent: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  cardTime: { marginTop: 6, fontSize: 11, color: '#9CA3AF' },
})
