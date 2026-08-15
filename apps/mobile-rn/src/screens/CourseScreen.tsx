/**
 * CourseScreen 课程 Tab 页(mobile-rn 端 wrapper)
 *
 * 对齐历史项目 pages/learn/learn.vue 结构(tab 页版,与 LearnScreen 同构):
 * - 学习进度概览(总课程数 / 已完成 / 学习时长)— getStudyStatistics
 * - 学习路径(横向滚动卡片,"更多"→ CourseFilter)— getHotLearnCourses
 * - 课程分类(4 列网格,"更多"→ CourseFilter,项→ CategoryDetail)— 复用 LearnScreen CATEGORIES
 * - 热门课程(PopularCourses 横向卡片,"更多"语义→ CourseDetail)
 * - 全部课程(搜索 + 分页列表)— getCourses
 */
import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getCourses,
  getHotLearnCourses,
  getStudyStatistics,
  type Course,
  type LearnCourse,
} from '@ihui/api-client'
import { CourseTabScreen, type CourseTabScreenProps } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { type LearnCategory } from './LearnScreen'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { MainStackParamList } from '../navigation/tab-utils'

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
function toPopularCourses(items: Course[]): CourseTabScreenProps['popularItems'][number][] {
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

/** 学习路径数据 → CourseTabScreen 路径项 */
function toCarouselItems(courses: LearnCourse[]): CourseTabScreenProps['paths'] {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    coverImage: c.coverImage ?? undefined,
  }))
}

/** 课程列表项适配 */
function toCourseListItems(items: Course[]): CourseTabScreenProps['courses'] {
  return items.map((c) => ({
    id: c.id,
    title: c.title,
    cover: c.cover ?? undefined,
    description: c.description,
    level: c.level,
    instructor: c.instructor,
    studentCount: c.studentCount,
    isFree: c.isFree,
    price: c.price,
  }))
}

export function CourseScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [reloadTick] = useState(0)
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

  const openCourse = (id: string) => rootNav?.navigate('CourseDetail', { id })
  /** "更多"→ 课程筛选页(对齐 Uniapp learn.vue more-link navigateTo) */
  const openBrowse = () => rootNav?.navigate('CourseFilter')
  /** 分类点击 → 分类详情页(对齐 Uniapp learn.vue navigateTo(item.path) 带 id) */
  const openCategory = (cat: LearnCategory) =>
    rootNav?.navigate('CategoryDetail', { categoryId: cat.id, title: cat.name })

  return (
    <CourseTabScreen
      t={t}
      progress={progress}
      paths={toCarouselItems(paths)}
      popularItems={toPopularCourses(courses)}
      courses={toCourseListItems(courses)}
      loading={loading}
      error={error}
      keyword={keyword}
      page={page}
      totalPages={totalPages}
      onKeywordChange={(v) => {
        setKeyword(v)
        setPage(1)
      }}
      onPageChange={setPage}
      onPressCourse={openCourse}
      onPressCategory={openCategory}
      onPressPath={openCourse}
      onPressMoreCourses={openBrowse}
      colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  )
}
