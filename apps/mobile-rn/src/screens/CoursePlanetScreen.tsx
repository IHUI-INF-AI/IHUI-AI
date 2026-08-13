/**
 * CoursePlanetScreen 课程星球页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/coursePlanet/index.vue(课程星球:推荐课程 / 课程赛道 / 最新课程):
 * - 顶部 NavBar(标题「课程星球」+ 返回)
 * - 三段横向课程列表(推荐 hot_courses / 赛道 beginner_courses / 最新 selected_courses)
 * - 数据加载:fetchApi 拉取 /api/course-planet(对齐 .vue getCoursePlanet)
 * - 下拉刷新 / 空态(Empty)/ 加载态(Loading)/ 错误重试
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 *
 * 与 KnowledgePlanetScreen(知识星球资讯页)区分:本页为课程列表,非资讯。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const API_PATH = '/api/course-planet'

const COVER_WIDTH = 140
const COVER_HEIGHT = 90
const COVER_INNER_WIDTH = COVER_WIDTH - 16

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

function priceLabel(course: CoursePlanetCourse): string {
  if (course.isFree) return '免费'
  if (course.price !== undefined && course.price !== null && course.price !== '') {
    return `¥${course.price}`
  }
  return '查看'
}

export function CoursePlanetScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [data, setData] = useState<CoursePlanetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

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

  const onCourseClick = (course: CoursePlanetCourse) => {
    navigation.navigate('CourseDetail', { id: String(course.id) })
  }

  const renderCourse = ({ item }: { item: CoursePlanetCourse }) => (
    <Pressable
      style={({ pressed }) => [styles.courseCard, pressed ? styles.courseCardPressed : null]}
      onPress={() => onCourseClick(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {item.cover ? (
        <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverPlaceholderText}>课程</Text>
        </View>
      )}
      <Text style={styles.courseTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.coursePrice}>{priceLabel(item)}</Text>
    </Pressable>
  )

  const renderSection = (title: string, courses: CoursePlanetCourse[] | undefined) => {
    if (!courses || courses.length === 0) return null
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <FlatList
          data={courses}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCourse}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionList}
        />
      </View>
    )
  }

  const hasData = Boolean(
    data &&
      (data.hot_courses?.length || data.beginner_courses?.length || data.selected_courses?.length),
  )

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
          {renderSection('推荐课程', data.hot_courses)}
          {renderSection('课程赛道', data.beginner_courses)}
          {renderSection('最新课程', data.selected_courses)}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tk.text.primary,
    marginBottom: 12,
  } as TextStyle,
  sectionList: {
    gap: 12,
    paddingRight: 4,
  } as ViewStyle,
  courseCard: {
    width: COVER_WIDTH,
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 8,
    gap: 6,
  } as ViewStyle,
  courseCardPressed: {
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  cover: {
    width: COVER_INNER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 8,
  } as ImageStyle,
  coverPlaceholder: {
    width: COVER_INNER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 8,
    backgroundColor: tk.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  coverPlaceholderText: {
    fontSize: 13,
    color: tk.text.tertiary,
  } as TextStyle,
  courseTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: tk.text.primary,
    lineHeight: 18,
  } as TextStyle,
  coursePrice: {
    fontSize: 12,
    color: tk.warning.amberText,
    fontWeight: '600',
  } as TextStyle,
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
