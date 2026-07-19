import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Chapter { id: string; title: string; duration: number; lessonCount: number }

type Route = RouteProp<RootStackParamList, 'CourseChapter'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PRIMARY = '#10B981'

export function CourseChapterScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Chapter[]>(`/api/courses/${encodeURIComponent(courseId)}/chapters`)
      if (cancelled) return
      if (res.success) setChapters(res.data ?? [])
      else setError(res.error || t('courseChapter.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [courseId, t])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('courseChapter.title')}</Text>
      <FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('common.empty')}</Text></View>}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CourseDetail', { id: item.id })}>
            <Text style={styles.idx}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta}>{t('courseChapter.lessons', { count: item.lessonCount })} · {item.duration}min</Text>
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
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  idx: { width: 28, fontSize: 14, fontWeight: '600', color: PRIMARY },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#111827' },
  meta: { marginTop: 2, fontSize: 11, color: '#9ca3af' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
