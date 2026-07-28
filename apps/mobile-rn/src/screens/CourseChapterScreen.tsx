import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { Card } from '@ihui/ui-native'

interface Chapter { id: string; title: string; duration: number; lessonCount: number }

type Route = RouteProp<RootStackParamList, 'CourseChapter'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

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
          <TouchableOpacity onPress={() => navigation.navigate('CourseDetail', { id: item.id })}>
            <Card className="flex-row items-center p-3 mb-2">
              <Text style={styles.idx}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.meta}>{t('courseChapter.lessons', { count: item.lessonCount })} · {item.duration}min</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg, paddingHorizontal: 16, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.surface.bg, padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary, marginBottom: 12 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, marginBottom: 8 },
  idx: { width: 28, fontSize: 14, fontWeight: '600', color: tokens.success.DEFAULT },
  cardTitle: { fontSize: 14, fontWeight: '500', color: tokens.text.primary },
  meta: { marginTop: 2, fontSize: 11, color: tokens.text.tertiary },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: tokens.success.DEFAULT },
  btnText: { color: tokens.surface.light, fontSize: 14 },
})
