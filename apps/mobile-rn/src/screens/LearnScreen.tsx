// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

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
import { tokens } from '../theme/active-tokens'
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
        {/* 动态按压态不得写成函数形态的 style:Pressable 被 cssInterop 注册过,函数声明会被展开成
            空对象而整份内联样式静默消失(守门 131 立项那一型)。外层只留纯布局档 flex 承接两个按钮
            的等分宽度,盒子的底色/圆角/内距下移到子 View 的数组形态上 —— 可见位置与尺寸一字不变。 */}
        <Pressable
          style={styles.entryBtnHit}
          onPress={() => navigation.navigate('LearnDevelop')}
          accessibilityRole="button"
          accessibilityLabel="学习发展"
        >
          {({ pressed }) => (
            <View style={[styles.entryBtn, pressed ? styles.entryBtnPressed : null]}>
              <Text style={styles.entryBtnText}>学习发展</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={styles.entryBtnHit}
          onPress={() => navigation.navigate('AiCareer')}
          accessibilityRole="button"
          accessibilityLabel="AI 学业规划"
        >
          {({ pressed }) => (
            <View style={[styles.entryBtn, pressed ? styles.entryBtnPressed : null]}>
              <Text style={styles.entryBtnText}>AI 学业规划</Text>
            </View>
          )}
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
  // 外层裸 Pressable 的命中层:只承接行内等分这一条纯布局档,不画任何底色/描边。
  entryBtnHit: {
    flex: 1,
  },
  entryBtn: {
    // 不得在这里写 flex: —— 等分宽度由外层 entryBtnHit 承担。
    // 整份样式原先挂在横向行里的 Pressable 上(flex 指宽度),搬到子 View 后同一份 flex 落在
    // 列方向上会把内容高度压成 0 ⇒ 按钮盒在、文字被裁掉(真机 VC53 实拍)。
    paddingVertical: 10,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brandAccent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBtnPressed: {
    opacity: 0.8,
  },
  entryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.brandAccent.foreground,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
