import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCourses, type Course } from '@ihui/api-client'
import {
  CourseScreen as SharedCourseScreen,
  type CourseScreenItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { CourseStackParamList } from '../navigation/RootNavigator'

const PAGE_SIZE = 12

type NavigationProp = NativeStackNavigationProp<CourseStackParamList>

export function CourseScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getCourses({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword.trim() || undefined,
      })
      if (cancelled) return
      if (res.success) {
        setCourses(res.data.list)
        setTotal(res.data.total)
      } else {
        setError(res.error || t('courseScreen.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [page, keyword, t])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const items: CourseScreenItem[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    level: c.level,
    description: c.description,
    isFree: c.isFree,
    price: c.price,
    studentCount: c.studentCount,
  }))

  return (
    <SharedCourseScreen
      t={t}
      items={items}
      keyword={keyword}
      loading={loading}
      error={error}
      page={page}
      totalPages={totalPages}
      onKeywordChange={(v) => {
        setKeyword(v)
        setPage(1)
      }}
      onPageChange={setPage}
      onPressItem={(id) => navigation.navigate('CourseDetail', { id })}
    />
  )
}
