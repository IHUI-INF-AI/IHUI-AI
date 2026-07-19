import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Bookmark { id: string; targetId: string; targetType: 'course' | 'article' | 'post' | 'note'; title: string; savedAt: string }

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function BookmarkScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true)
    setError('')
    const res = await fetchApi<Bookmark[]>('/api/bookmarks')
    if (res.success) setItems(res.data ?? [])
    else setError(res.error || t('bookmark.loadFailed'))
    setLoading(false); setRefreshing(false)
  }

  useEffect(() => { void load() }, [])

  const onPress = (item: Bookmark) => {
    if (item.targetType === 'course') navigation.navigate('CourseDetail', { id: item.targetId })
    else if (item.targetType === 'article') navigation.navigate('ArticleDetail', { id: item.targetId })
    else if (item.targetType === 'post') navigation.navigate('PostDetail', { id: item.targetId })
    else if (item.targetType === 'note') navigation.navigate('NoteDetail', { id: item.targetId })
  }

  const onRemove = async (item: Bookmark) => {
    const res = await fetchApi<void>(`/api/bookmarks/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
    if (res.success) setItems((prev) => prev.filter((b) => b.id !== item.id))
    else setError(res.error || t('common.failed'))
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
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('bookmark.title')}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('bookmark.empty')}</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => onPress(item)}>
              <View style={styles.cardHead}>
                <Text style={styles.type}>{t(`bookmark.type.${item.targetType}`)}</Text>
                <Text style={styles.meta}>{item.savedAt}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(item)}>
              <Text style={styles.removeText}>{t('bookmark.remove')}</Text>
            </TouchableOpacity>
          </View>
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
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  type: { fontSize: 10, color: PRIMARY, backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  meta: { fontSize: 11, color: '#9ca3af' },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#111827' },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fef2f2', marginLeft: 8 },
  removeText: { fontSize: 12, color: '#dc2626' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
