// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  CourseCommentScreen as SharedCourseCommentScreen,
  type CourseCommentItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CourseComment'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CourseCommentScreen() {
  const { resolvedTheme } = useTheme()
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
      else setError(apiFailureToText(res, t('courseComment.loadFailed')))
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
      colorScheme={resolvedTheme}
    />
  )
}
