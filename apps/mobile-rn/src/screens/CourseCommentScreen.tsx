import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { CommentRecord } from '@ihui/types'
import { Card } from '@ihui/ui-native'

interface Comment extends Pick<CommentRecord, 'content'> {
  id: string // 本地是 string,共享是 number,保留本地类型
  user: string // = user_name 别名
  rating: number // 本地特有
  createdAt: string // = created_at 别名
}

type Route = RouteProp<RootStackParamList, 'CourseComment'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CourseCommentScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Comment[]>(`/api/courses/${encodeURIComponent(courseId)}/comments`)
      if (cancelled) return
      if (res.success) setComments(res.data ?? [])
      else setError(res.error || t('courseComment.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, t])

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  if (error)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('courseComment.title')}</Text>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('courseComment.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card className="p-3 mb-2">
            <View style={styles.row}>
              <Text style={styles.user}>{item.user}</Text>
              <Text style={styles.rating}>★ {item.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.content}>{item.content}</Text>
            <Text style={styles.meta}>{item.createdAt}</Text>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg, paddingHorizontal: 16, paddingTop: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.bg,
    padding: 16,
  },
  muted: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary, marginBottom: 12 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  user: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  rating: { fontSize: 12, color: tokens.success.DEFAULT },
  content: { marginTop: 6, fontSize: 13, color: tokens.text.medium },
  meta: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  btn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  btnText: { color: tokens.surface.light, fontSize: 14 },
})
