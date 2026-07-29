import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  CourseCommentScreen as SharedCourseCommentScreen,
  type CourseCommentItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { CommentRecord } from '@ihui/types'

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

  const items: CourseCommentItem[] = comments.map((c) => ({
    id: c.id,
    user: c.user,
    rating: c.rating,
    content: c.content,
    createdAt: c.createdAt,
  }))

  return (
    <SharedCourseCommentScreen
      t={t}
      items={items}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
