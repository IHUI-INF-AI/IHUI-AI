import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Article { id: string; title: string; author: string; content: string; cover?: string; views: number; likes: number; publishedAt: string }

type Route = RouteProp<RootStackParamList, 'ArticleDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PRIMARY = '#10B981'

export function ArticleDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Article>(`/api/articles/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setArticle(res.data)
      else setError(res.error || t('articleDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error || !article) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error || t('articleDetail.loadFailed')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{article.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{article.author}</Text>
        <Text style={styles.meta}>{article.publishedAt}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.stat}>{t('articleDetail.views', { count: article.views })}</Text>
        <Text style={styles.stat}>❤ {article.likes}</Text>
      </View>
      <Text style={styles.content}>{article.content}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
  author: { fontSize: 13, color: PRIMARY, fontWeight: '500' },
  meta: { fontSize: 11, color: '#9ca3af' },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: { fontSize: 11, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  content: { fontSize: 14, lineHeight: 22, color: '#374151' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
