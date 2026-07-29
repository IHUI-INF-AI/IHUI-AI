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

type Route = RouteProp<RootStackParamList, 'CourseComment'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CourseCommentScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params
  const [comments, setComments] = useState<CourseCommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<CourseCommentItem[]>(
        `/api/courses/${encodeURIComponent(courseId)}/comments`,
      )
      if (cancelled) return
      if (res.success) setComments(res.data ?? [])
      else setError(res.error || t('courseComment.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, t])

  return (
    <SharedCourseCommentScreen
      t={t}
      items={comments}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
