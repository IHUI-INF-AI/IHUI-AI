import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCourses, type Course } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { MoreCourseScreen as SharedMoreCourseScreen } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

export function MoreCourseScreen() {
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (opts: { reset?: boolean; nextPage?: number } = {}) => {
    const reset = opts.reset ?? false
    const targetPage = opts.nextPage ?? 1
    if (reset) {
      setLoading(true)
      setError('')
    }
    try {
      const res = await getCourses({ page: targetPage, pageSize: PAGE_SIZE })
      if (!res.success) throw new Error(res.error)
      const list = res.data.list ?? []
      setItems((prev) => (reset ? list : [...prev, ...list]))
      setTotal(res.data.total ?? 0)
      setPage(targetPage)
    } catch {
      setError('加载失败,请下拉刷新重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void load({ reset: true })
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load({ reset: true })
  }

  const onEndReached = () => {
    if (loadingMore || loading || refreshing) return
    if (items.length >= total) return
    setLoadingMore(true)
    void load({ reset: false, nextPage: page + 1 })
  }

  const showDetail = (item: Course) => {
    navigation.navigate('CourseDetail', { id: String(item.id) })
  }

  const onPressItem = (item: { id: string | number; title: string }) => {
    showDetail(item as Course)
  }

  return (
    <SharedMoreCourseScreen
      t={useI18n().t}
      items={items.map((item) => ({
        id: item.id,
        title: item.title,
        cover: item.cover ?? undefined,
        instructor: item.instructor,
        lessonCount: item.lessonCount,
        price: item.price,
        isFree: item.isFree,
        studentCount: item.studentCount,
      }))}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      error={error}
      total={total}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onPressItem={onPressItem}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
