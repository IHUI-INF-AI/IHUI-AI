import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  ArticleDetailScreen as SharedArticleDetailScreen,
  type ArticleDetailItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'ArticleDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ArticleDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [article, setArticle] = useState<ArticleDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<ArticleDetailItem>(`/api/articles/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setArticle(res.data)
      else setError(res.error || t('articleDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  return (
    <SharedArticleDetailScreen
      t={t}
      item={article}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
