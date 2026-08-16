import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  CourseChapterScreen as SharedCourseChapterScreen,
  type CourseChapterItem,
} from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CourseChapter'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CourseChapterScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params
  const [chapters, setChapters] = useState<CourseChapterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<CourseChapterItem[]>(
        `/api/courses/${encodeURIComponent(courseId)}/chapters`,
      )
      if (cancelled) return
      if (res.success) setChapters(res.data ?? [])
      else setError(res.error || t('courseChapter.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, t])

  return (
    <SharedCourseChapterScreen
      t={t}
      items={chapters}
      loading={loading}
      error={error}
      onPressItem={(item) => navigation.navigate('CourseDetail', { id: item.id })}
      onBack={() => navigation.goBack()}
    />
  )
}
