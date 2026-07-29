import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { enrollCourse, getCourses, type Course } from '@ihui/api-client'
import {
  CourseEnrollScreen as SharedCourseEnrollScreen,
  type CourseEnrollItem,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toCourseEnrollItem(c: Course): CourseEnrollItem {
  return {
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    level: c.level,
    lessonCount: c.lessonCount,
    studentCount: c.studentCount,
    price: c.price,
    isFree: c.isFree,
    isEnrolled: c.isEnrolled,
  }
}

export function CourseEnrollScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<CourseEnrollItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await getCourses({ keyword: keyword || undefined, pageSize: 20 })
      if (res.success) {
        setItems((res.data.list ?? []).map(toCourseEnrollItem))
      } else {
        setError(res.error || t('courseEnroll.loadFailed'))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [keyword, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleEnroll = async (item: CourseEnrollItem) => {
    if (item.isEnrolled || enrollingId) return
    setEnrollingId(item.id)
    setToast('')
    const res = await enrollCourse(item.id)
    setEnrollingId(null)
    if (res.success) {
      setItems((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isEnrolled: true } : c)),
      )
      setToast(t('courseEnroll.enrollSuccess', { title: item.title }))
    } else {
      setToast(res.error || t('courseEnroll.enrollFailed'))
    }
  }

  return (
    <SharedCourseEnrollScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      keyword={keyword}
      enrollingId={enrollingId}
      toast={toast}
      userNickname={user?.nickname ?? user?.username ?? ''}
      onKeywordChange={setKeyword}
      onSearch={() => void load()}
      onRefresh={() => void load(true)}
      onEnroll={handleEnroll}
      onBack={() => navigation.goBack()}
    />
  )
}
