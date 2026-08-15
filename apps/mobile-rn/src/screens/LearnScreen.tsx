import { useCallback, useEffect, useState } from 'react'
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

export function LearnScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
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
      paths={paths.map((p) => ({
        id: p.id,
        title: p.title,
        coverImage: p.coverImage ?? undefined,
      }))}
      recommended={recommended.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        coverImage: r.coverImage ?? undefined,
        difficulty: r.difficulty,
        duration: r.duration,
      }))}
      loading={loading}
      error={error}
      onOpenCourse={openCourse}
      onOpenBrowse={openBrowse}
      onOpenCategory={openCategory}
      categories={CATEGORIES as LearnCategory[]}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
