/**
 * CoursePlanetScreen 课程星球页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/coursePlanet/index.vue(课程星球:推荐课程 / 课程赛道 / 最新课程):
 * - 顶部 NavBar(标题「课程星球」+ 返回)
 * - 三段横向课程列表(推荐 hot_courses / 赛道 beginner_courses / 最新 selected_courses)
 * - 数据加载:fetchApi 拉取 /api/course-planet(对齐 .vue getCoursePlanet)
 * - 下拉刷新 / 空态(Empty)/ 加载态(Loading)/ 错误重试
 * - SingleTypeBar 课程类型筛选(全部/免费/付费)驱动真实数据过滤
 * - Menu 功能菜单(id=4 跳 Agent,其余弹"功能开发中"Alert)
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 *
 * 与 KnowledgePlanetScreen(知识星球资讯页)区分:本页为课程列表,非资讯。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import { NavBar } from '../components/NavBar'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import MoreTitles from '../components/MoreTitles'
import Menu from '../components/Menu'
import { SingleTypeBar, type SingleTypeBarItem } from '../components/SingleTypeBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const API_PATH = '/api/course-planet'

/** 课程类型单选清单(对齐 Uniapp type-bar/single.vue options) */
const COURSE_TYPE_ITEMS: readonly SingleTypeBarItem[] = [
  { id: 'all', label: '全部' },
  { id: 'free', label: '免费' },
  { id: 'paid', label: '付费' },
]

interface CoursePlanetCourse {
  id: string | number
  title: string
  cover?: string
  price?: number | string
  isFree?: boolean
  type?: number
}

interface CoursePlanetData {
  beginner_courses?: CoursePlanetCourse[]
  selected_courses?: CoursePlanetCourse[]
  hot_courses?: CoursePlanetCourse[]
}

/** 课程数据 → CourseCarouselItem(cover→img,price 转数字,isFree/type 透传) */
function toCarouselItems(courses: CoursePlanetCourse[]): CourseCarouselItem[] {
  return courses.map((c) => {
    const rawPrice = typeof c.price === 'number' ? c.price : Number(c.price)
    return {
      id: String(c.id),
      title: c.title,
      price: Number.isFinite(rawPrice) ? rawPrice : 0,
      isFree: c.isFree,
      img: c.cover,
      type: c.type === 1 || c.type === 2 ? c.type : undefined,
    }
  })
}

export function CoursePlanetScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [data, setData] = useState<CoursePlanetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  /** 课程类型单选(对齐 Uniapp type-bar/single.vue:全部/免费/付费) */
  const [selectedType, setSelectedType] = useState('all')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<CoursePlanetData>(API_PATH)
      if (!res.success) throw new Error(res.error)
      setData(res.data)
    } catch {
      setError('加载失败,请下拉刷新重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const onCourseClick = (id: string) => {
    navigation.navigate('CourseDetail', { id })
  }

  /** 按 selectedType 过滤课程:all=全部 / free=免费 / paid=付费 */
  const filterByType = useCallback(
    (courses: CoursePlanetCourse[] | undefined): CoursePlanetCourse[] => {
      if (!courses || courses.length === 0) return []
      if (selectedType === 'all') return courses
      if (selectedType === 'free') return courses.filter((c) => c.isFree === true)
      // paid:非免费(含 isFree=false 或 isFree 未定义但有 price)
      return courses.filter((c) => c.isFree !== true)
    },
    [selectedType],
  )

  const hotCourses = useMemo(() => filterByType(data?.hot_courses), [data, filterByType])
  const beginnerCourses = useMemo(() => filterByType(data?.beginner_courses), [data, filterByType])
  const selectedCourses = useMemo(() => filterByType(data?.selected_courses), [data, filterByType])

  const renderSection = (title: string, courses: CoursePlanetCourse[]) => {
    if (courses.length === 0) return null
    return (
      <View style={styles.section}>
        <MoreTitles title={title} onMore={() => navigation.navigate('CourseFilter')} />
        <CourseCarousel courses={toCarouselItems(courses)} onPress={onCourseClick} />
      </View>
    )
  }

  const hasData = Boolean(
    data &&
      (data.hot_courses?.length || data.beginner_courses?.length || data.selected_courses?.length),
  )

  /** Menu 功能菜单点击:id=4 跳 Agent,其余弹"功能开发中"提示 */
  const onMenuPress = (id: number | string) => {
    if (Number(id) === 4) {
      const parent = navigation.getParent<NavigationProp>()
      parent?.navigate('Agent')
      return
    }
    Alert.alert('功能开发中', '此功能正在开发中,敬请期待')
  }

  return (
    <View style={styles.container}>
      <NavBar title="课程星球" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centerWrap}>
          <Loading text="加载中..." />
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>{t('common.ok')}</Text>
          </Pressable>
        </View>
      ) : hasData && data ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={resolvedTheme === 'dark' ? tk.text.tertiary : tk.text.secondary}
            />
          }
        >
          {/* Menu 功能菜单网格(对齐 Uniapp coursePlanet 菜单入口) */}
          <View style={styles.menuWrap}>
            <Menu columns={4} onPress={(item) => onMenuPress(item.id)} />
          </View>

          {/* SingleTypeBar 单选课程类型(对齐 Uniapp type-bar/single.vue),onSelect 驱动真实数据过滤 */}
          <View style={styles.singleTypeBarWrap}>
            <SingleTypeBar
              items={COURSE_TYPE_ITEMS}
              selectedId={selectedType}
              onSelect={setSelectedType}
            />
          </View>

          {renderSection('推荐课程', hotCourses)}
          {renderSection('课程赛道', beginnerCourses)}
          {renderSection('最新课程', selectedCourses)}
        </ScrollView>
      ) : (
        <View style={styles.centerWrap}>
          <Empty text="暂无课程" icon="📚" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  flex: { flex: 1 } as ViewStyle,
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  } as ViewStyle,
  section: {
    marginBottom: 20,
  } as ViewStyle,
  menuWrap: {
    marginBottom: 16,
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    paddingVertical: 8,
  } as ViewStyle,
  singleTypeBarWrap: {
    marginBottom: 16,
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    paddingVertical: 4,
  } as ViewStyle,
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  } as ViewStyle,
  errorText: {
    fontSize: 14,
    color: tk.error.text,
    textAlign: 'center',
  } as TextStyle,
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tk.brand.DEFAULT,
  } as ViewStyle,
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: tk.surface.light,
  } as TextStyle,
})

export default CoursePlanetScreen
