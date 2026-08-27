import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
import { Smartphone, Users, PenLine, BarChart3 } from 'lucide-react-native'
import type { AppIcon } from '@ihui/types'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface ProgressOverview {
  totalCourses: number
  completedCourses: number
  learningHours: number
}

export interface LearnCategory {
  id: string
  name: string
  icon: AppIcon | string
}

export const CATEGORIES: readonly LearnCategory[] = [
  { id: 'douyin', name: '抖音运营', icon: Smartphone },
  { id: 'private', name: '私域运营', icon: Users },
  { id: 'content', name: '内容创作', icon: PenLine },
  { id: 'data', name: '数据分析', icon: BarChart3 },
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
    <View style={styles.container}>
      {/* 学习发展 / AI 学业规划入口(孤儿路由修复:LearnDevelop/AiCareer 注册无入口,学习中心补挂) */}
      <View style={styles.entryRow}>
        <Pressable
          style={({ pressed }) => [styles.entryBtn, pressed ? styles.entryBtnPressed : null]}
          onPress={() => navigation.navigate('LearnDevelop')}
          accessibilityRole="button"
          accessibilityLabel="学习发展"
        >
          <Text style={styles.entryBtnText}>学习发展</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.entryBtn, pressed ? styles.entryBtnPressed : null]}
          onPress={() => navigation.navigate('AiCareer')}
          accessibilityRole="button"
          accessibilityLabel="AI 学业规划"
        >
          <Text style={styles.entryBtnText}>AI 学业规划</Text>
        </Pressable>
      </View>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  entryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  entryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#5088fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBtnPressed: {
    opacity: 0.8,
  },
  entryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
