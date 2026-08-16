import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { PostDetailScreen as SharedPostDetailScreen, type PostDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'PostDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function PostDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [post, setPost] = useState<PostDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<PostDetailItem>(`/api/posts/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setPost(res.data)
      else setError(res.error || t('postDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  return (
    <SharedPostDetailScreen
      t={t}
      item={post}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
