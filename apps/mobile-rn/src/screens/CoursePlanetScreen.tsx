// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CoursePlanetScreen 课程星球页 —— mobile-rn 薄壳。
 *
 * 渲染主体是共享层 `@ihui/rn-app` 的 CoursePlanetScreen（单一真相源）：
 * 壳侧只保留数据加载（`GET /api/course-planet`）、tab 选中态与导航端口注入，
 * 不再复制共享屏的课程列表渲染。
 *
 * 路由与入口：RootNavigator.tsx:678/1245，drawer-nav.ts:259/921-922。
 * 端口口径：共享屏全部 props 逐项真实接线；`onRetry` 单独绑定真实 reload，
 * 不用 `onRetry ?? onRefresh` 之类的别名，也不回落空函数。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { toUserFriendlyMessage } from '@ihui/shared/utils'
import { CoursePlanetScreen as SharedCoursePlanetScreen } from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type CourseType = 'all' | 'free' | 'paid'

/** 课程星球接口返回的单门课程(沿用本页既有取数契约) */
interface PlanetCourse {
  id: string
  title: string
  coverImage?: string
  price: number
  isFree: boolean
}

interface PlanetData {
  hot: PlanetCourse[]
  beginner: PlanetCourse[]
  selected: PlanetCourse[]
}

const EMPTY_DATA: PlanetData = { hot: [], beginner: [], selected: [] }

export function CoursePlanetScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [data, setData] = useState<PlanetData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState<CourseType>('all')

  // 对齐原 coursePlanet():getCoursePlanet → beginner_courses/selected_courses/hot_courses
  const reload = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<PlanetData>('/api/course-planet')
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setError(t('common.loadFailPullRetry'))
      }
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      setError(detail.trim() ? toUserFriendlyMessage(e) : t('common.loadFailPullRetry'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void reload()
  }, [reload])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void reload()
  }, [reload])

  return (
    <SharedCoursePlanetScreen
      t={t}
      data={data}
      loading={loading}
      refreshing={refreshing}
      error={error}
      selectedType={selectedType}
      onTypeChange={setSelectedType}
      onCoursePress={(id) => navigation.navigate('CourseDetail', { id })}
      onRefresh={onRefresh}
      onBack={() => navigation.goBack()}
      onRetry={reload}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
