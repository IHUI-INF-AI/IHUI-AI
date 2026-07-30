import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCourses, type Course } from '@ihui/api-client'
import { CourseScreen as SharedCourseScreen, type CourseScreenItem } from '@ihui/rn-app'
import PopularCourses, {
  type PopularCourse as PopularCourseItem,
} from '../components/PopularCourses'
import { useI18n } from '../i18n'
import type { CourseStackParamList } from '../navigation/RootNavigator'

const PAGE_SIZE = 12

type NavigationProp = NativeStackNavigationProp<CourseStackParamList>

/** Course → PopularCourses 卡片项,VIP 标识用 tags 启发式判断(后端未提供 isVip 字段) */
function toPopularCourses(items: Course[]): PopularCourseItem[] {
  return items.slice(0, 6).map((c) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    lessons: c.lessonCount,
    price: c.price,
    isFree: c.isFree,
    isVip: c.tags.some((tag) => tag.toLowerCase().includes('vip')),
    studentCount: c.studentCount,
  }))
}

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
        setError(res.error || t('course.loadFailed'))
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
    description: c.description ?? undefined,
    instructor: c.instructor,
    studentCount: c.studentCount,
    price: c.price,
    isFree: c.isFree,
    level: c.level as CourseScreenItem['level'],
    cover: c.cover ?? undefined,
  }))

  const popularItems = useMemo<PopularCourseItem[]>(
    () => toPopularCourses(courses),
    [courses],
  )

  return (
    <View style={shellStyles.root}>
      <View style={shellStyles.popularWrap}>
        <PopularCourses
          courses={popularItems}
          title="热门课程"
          subtitle="本周学习人数 Top"
          onPress={(id) => navigation.navigate('CourseDetail', { id })}
        />
      </View>
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
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  popularWrap: { paddingTop: 4, paddingBottom: 4 } as const,
}
