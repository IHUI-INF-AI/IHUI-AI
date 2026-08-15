import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
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
import {
  getHotLearnCourses,
  getRecommendLearnCourses,
  getStudyStatistics,
  type LearnCourse,
} from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import { LearnScreen as SharedLearnScreen } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface ProgressOverview {
  totalCourses: number
  completedCourses: number
  learningHours: number
}

export interface LearnCategory {
  id: string
  name: string
  icon: string
}

export const CATEGORIES: readonly LearnCategory[] = [
  { id: 'douyin', name: '抖音运营', icon: '📱' },
  { id: 'private', name: '私域运营', icon: '👥' },
  { id: 'content', name: '内容创作', icon: '✍️' },
  { id: 'data', name: '数据分析', icon: '📊' },
] as const

function difficultyLabel(d: LearnCourse['difficulty'] | undefined): string {
  if (d === 'beginner') return '入门'
  if (d === 'intermediate') return '进阶'
  if (d === 'advanced') return '高级'
  return ''
}

function formatCourseDuration(duration: number | undefined): string {
  if (!duration || duration <= 0) return ''
  if (duration < 60) return `${duration}分钟`
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

function toCarouselItems(courses: LearnCourse[]): CourseCarouselItem[] {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    price: 0,
    isFree: true,
    img: c.coverImage ?? undefined,
  }))
}

export function LearnScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [progress, setProgress] = useState<ProgressOverview | null>(null)
  const [paths, setPaths] = useState<LearnCourse[]>([])
  const [recommended, setRecommended] = useState<LearnCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [statsRes, hotRes, recommendRes] = await Promise.all([
        getStudyStatistics(),
        getHotLearnCourses(6),
        getRecommendLearnCourses(6),
      ])
      if (statsRes.success && statsRes.data) {
        const d = statsRes.data
        setProgress({
          totalCourses: d.totalCourses,
          completedCourses: d.completedCourses,
          learningHours: Math.round((d.totalDuration ?? 0) / 3600),
        })
      }
      if (hotRes.success) setPaths(hotRes.data ?? [])
      if (recommendRes.success) setRecommended(recommendRes.data ?? [])
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const openCourse = (id: string) => navigation.navigate('CourseDetail', { id })
  const openBrowse = () => navigation.navigate('CourseFilter')
  const openCategory = (cat: LearnCategory) =>
    navigation.navigate('CategoryDetail', { categoryId: cat.id, title: cat.name })

  return (
    <SharedLearnScreen
      t={t}
      progress={progress}
      paths={paths.map((p) => ({ id: p.id, title: p.title, coverImage: p.coverImage }))}
      recommended={recommended.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        coverImage: r.coverImage,
        difficulty: r.difficulty,
        duration: r.duration,
      }))}
      loading={loading}
      error={error}
      onOpenCourse={openCourse}
      onOpenBrowse={openBrowse}
      onOpenCategory={openCategory}
      categories={CATEGORIES}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
