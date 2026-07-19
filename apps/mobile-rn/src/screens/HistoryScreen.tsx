import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface HistoryItem { id: string; targetId: string; targetType: 'course' | 'article' | 'post' | 'note' | 'live'; title: string; visitedAt: string }

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function HistoryScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true)
    setError('')
    const res = await fetchApi<HistoryItem[]>('/api/history')
    if (res.success) setItems(res.data ?? [])
    else setError(res.error || t('history.loadFailed'))
    setLoading(false); setRefreshing(false)
  }

  useEffect(() => { void load() }, [])

  const onPress = (item: HistoryItem) => {
    if (item.targetType === 'course') navigation.navigate('CourseDetail', { id: item.targetId })
    else if (item.targetType === 'article') navigation.navigate('ArticleDetail', { id: item.targetId })
    else if (item.targetType === 'post') navigation.navigate('PostDetail', { id: item.targetId })
    else if (item.targetType === 'note') navigation.navigate('NoteDetail', { id: item.targetId })
    else if (item.targetType === 'live') navigation.navigate('LiveDetail', { id: item.targetId })
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error && items.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
        <TouchableOpacity onPress={() => load(true)}><Text style={styles.clear}>{t('history.refresh')}</Text></TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('history.empty')}</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onPress(item)}>
            <View style={styles.cardHead}>
              <Text style={styles.type}>{t(`history.type.${item.targetType}`)}</Text>
              <Text style={styles.meta}>{item.visitedAt}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  back: { fontSize: 14, color: '#6b7280' },
  title: { flex: 1, fontSize: 22, fontWeight: '600', color: '#111827' },
  clear: { fontSize: 13, color: PRIMARY },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  type: { fontSize: 10, color: PRIMARY, backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  meta: { fontSize: 11, color: '#9ca3af' },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#111827' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
