/**
 * CourseScreen 课程 Tab 页(mobile-rn 端)
 *
 * 对齐历史项目 pages/learn/learn.vue 结构(tab 页版,与 LearnScreen 同构):
 * - 学习进度概览(总课程数 / 已完成 / 学习时长)— getStudyStatistics
 * - 学习路径(横向滚动卡片,"更多"→ CourseFilter)— getHotLearnCourses
 * - 课程分类(4 列网格,"更多"→ CourseFilter,项→ CategoryDetail)— 复用 LearnScreen CATEGORIES
 * - 热门课程(PopularCourses 横向卡片,"更多"语义→ CourseDetail)
 * - 全部课程(搜索 + 分页列表)— getCourses
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getCourses,
  getHotLearnCourses,
  getStudyStatistics,
  type Course,
  type LearnCourse,
} from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import PopularCourses, {
  type PopularCourse as PopularCourseItem,
} from '../components/PopularCourses'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { CATEGORIES, type LearnCategory } from './LearnScreen'
import type { MainStackParamList, RootStackParamList } from '../navigation/RootNavigator'

const PAGE_SIZE = 12

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'CourseMain'>
type RootNav = NativeStackNavigationProp<RootStackParamList>

/** 学习进度概览(对齐 getStudyStatistics 返回,totalDuration 视为秒) */
interface ProgressOverview {
  totalCourses: number
  completedCourses: number
  learningHours: number
}

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

/** 学习路径数据 → CourseCarouselItem(coverImage→img,学习路径默认免费) */
function toCarouselItems(courses: LearnCourse[]): CourseCarouselItem[] {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    price: 0,
    isFree: true,
    img: c.coverImage ?? undefined,
  }))
}

export function CourseScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [reloadTick, setReloadTick] = useState(0)
  const [progress, setProgress] = useState<ProgressOverview | null>(null)
  const [paths, setPaths] = useState<LearnCourse[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [coursesRes, statsRes, hotRes] = await Promise.all([
        getCourses({
          page,
          pageSize: PAGE_SIZE,
          keyword: keyword.trim() || undefined,
        }),
        getStudyStatistics(),
        getHotLearnCourses(6),
      ])
      if (cancelled) return
      if (coursesRes.success) {
        setCourses(coursesRes.data.list)
        setTotal(coursesRes.data.total)
      } else {
        setError(coursesRes.error || t('common.loadFailed'))
      }
      if (statsRes.success && statsRes.data) {
        const d = statsRes.data
        setProgress({
          totalCourses: d.totalCourses,
          completedCourses: d.completedCourses,
          learningHours: Math.round((d.totalDuration ?? 0) / 3600),
        })
      }
      if (hotRes.success) setPaths(hotRes.data ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [page, keyword, reloadTick, t])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const popularItems = useMemo<PopularCourseItem[]>(() => toPopularCourses(courses), [courses])

  const openCourse = (id: string) => rootNav?.navigate('CourseDetail', { id })
  /** "更多"→ 课程筛选页(对齐 Uniapp learn.vue more-link navigateTo) */
  const openBrowse = () => rootNav?.navigate('CourseFilter')
  /** 分类点击 → 分类详情页(对齐 Uniapp learn.vue navigateTo(item.path) 带 id) */
  const openCategory = (cat: LearnCategory) =>
    rootNav?.navigate('CategoryDetail', { categoryId: cat.id, title: cat.name })

  const renderSectionHeader = (title: string, onMore?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onMore ? (
        <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onMore}>
          <Text style={styles.moreLink}>{'更多'}</Text>
        </Pressable>
      ) : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 学习进度概览(对齐 Uniapp learn.vue 行 3-17) */}
        <View style={styles.progressOverview}>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{progress?.totalCourses ?? 0}</Text>
            <Text style={styles.progressLabel}>{'总课程数'}</Text>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{progress?.completedCourses ?? 0}</Text>
            <Text style={styles.progressLabel}>{'已完成'}</Text>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{progress?.learningHours ?? 0}</Text>
            <Text style={styles.progressLabel}>{'学习时长(小时)'}</Text>
          </View>
        </View>

        {/* 学习路径(对齐 Uniapp learn.vue 行 19-41,300rpx≈150dp 横向卡片) */}
        <View style={styles.section}>
          {renderSectionHeader('学习路径', openBrowse)}
          {paths.length === 0 ? (
            <Empty />
          ) : (
            <CourseCarousel courses={toCarouselItems(paths)} onPress={openCourse} />
          )}
        </View>

        {/* 课程分类(对齐 Uniapp learn.vue 行 43-60,4 列网格 80rpx≈40dp 图标) */}
        <View style={styles.section}>
          {renderSectionHeader('课程分类', openBrowse)}
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={styles.categoryItem}
                onPress={() => openCategory(cat)}
                accessibilityRole="button"
                accessibilityLabel={cat.name}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={styles.categoryName}>{cat.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 热门课程(横向卡片,自带标题头) */}
        <View style={styles.popularWrap}>
          <PopularCourses
            courses={popularItems}
            title="热门课程"
            subtitle="本周学习人数 Top"
            onPress={openCourse}
          />
        </View>

        {/* 全部课程(搜索 + 分页列表) */}
        <View style={styles.section}>
          {renderSectionHeader('全部课程', openBrowse)}
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={(v) => {
              setKeyword(v)
              setPage(1)
            }}
            placeholder="搜索课程"
            placeholderTextColor={tk.text.tertiary}
            returnKeyType="search"
          />
          {error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable hitSlop={8} onPress={() => setReloadTick((v) => v + 1)}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : loading ? (
            <Loading text="加载中..." />
          ) : courses.length === 0 ? (
            <Empty text="暂无课程" />
          ) : (
            <View style={styles.courseList}>
              {courses.map((c) => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [
                    styles.courseCard,
                    pressed ? styles.courseCardPressed : null,
                  ]}
                  onPress={() => openCourse(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={c.title}
                >
                  {c.cover ? (
                    <Image
                      source={{ uri: c.cover }}
                      style={styles.courseImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.courseInfo}>
                    <Text style={styles.courseTitle} numberOfLines={2}>
                      {c.title}
                    </Text>
                    {c.description ? (
                      <Text style={styles.courseDesc} numberOfLines={2}>
                        {c.description}
                      </Text>
                    ) : null}
                    <View style={styles.courseMeta}>
                      {c.level ? (
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelText}>{c.level}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.metaText}>
                        {c.instructor} · {t('course.studentCount', { count: c.studentCount })}
                      </Text>
                    </View>
                    <Text style={c.isFree ? styles.priceFree : styles.pricePaid}>
                      {c.isFree ? '免费' : `¥${c.price.toFixed(2)}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {totalPages > 1 ? (
                <View style={styles.pagination}>
                  <Pressable
                    onPress={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    hitSlop={8}
                  >
                    <Text style={[styles.pageBtn, page <= 1 ? styles.pageBtnDisabled : null]}>
                      {t('common.back')}
                    </Text>
                  </Pressable>
                  <Text style={styles.pageIndicator}>
                    {page} / {totalPages}
                  </Text>
                  <Pressable
                    onPress={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    hitSlop={8}
                  >
                    <Text
                      style={[styles.pageBtn, page >= totalPages ? styles.pageBtnDisabled : null]}
                    >
                      下一页
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: RnThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    scroll: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      paddingBottom: 24,
    } as ViewStyle,
    popularWrap: {
      paddingTop: 4,
      paddingBottom: 4,
    } as ViewStyle,

    // 进度概览(对齐 Uniapp learn.vue progress-overview)
    progressOverview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 20,
      marginBottom: 8,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    progressItem: {
      alignItems: 'center',
    } as ViewStyle,
    progressNum: {
      fontSize: 24,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      marginBottom: 4,
    } as TextStyle,
    progressLabel: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,

    // 区块(对齐 Uniapp learn.vue section)
    section: {
      padding: 16,
      marginBottom: 8,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    } as ViewStyle,
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    moreLink: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,

    // 课程分类(4 列,对齐 Uniapp learn.vue category-grid)
    categoryGrid: {
      flexDirection: 'row',
      paddingVertical: 4,
      gap: 12,
    } as ViewStyle,
    categoryItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      gap: 8,
    } as ViewStyle,
    categoryIcon: {
      fontSize: 32,
    } as TextStyle,
    categoryName: {
      fontSize: 12,
      color: tk.text.primary,
    } as TextStyle,

    // 全部课程
    searchInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      marginBottom: 12,
    } as TextStyle,
    errorWrap: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
    } as ViewStyle,
    errorText: {
      fontSize: 13,
      color: tk.danger.DEFAULT,
      textAlign: 'center',
    } as TextStyle,
    retryText: {
      fontSize: 14,
      color: tk.brand.DEFAULT,
    } as TextStyle,
    courseList: {
      gap: 12,
    } as ViewStyle,
    courseCard: {
      flexDirection: 'row',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    courseCardPressed: {
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    courseImage: {
      width: 110,
      height: 110,
      backgroundColor: tk.border.light,
    } as ImageStyle,
    courseInfo: {
      flex: 1,
      padding: 12,
      gap: 6,
    } as ViewStyle,
    courseTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    courseDesc: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
    courseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    } as ViewStyle,
    levelBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tk.purple.light,
    } as ViewStyle,
    levelText: {
      fontSize: 11,
      fontWeight: '600',
      color: tk.purple.DEFAULT,
    } as TextStyle,
    metaText: {
      fontSize: 11,
      color: tk.text.secondary,
    } as TextStyle,
    priceFree: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    } as TextStyle,
    pricePaid: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    } as ViewStyle,
    pageBtn: {
      fontSize: 14,
      color: tk.text.primary,
    } as TextStyle,
    pageBtnDisabled: {
      opacity: 0.4,
    } as TextStyle,
    pageIndicator: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
  })
}
