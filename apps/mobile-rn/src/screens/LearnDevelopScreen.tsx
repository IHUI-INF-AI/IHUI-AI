// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useCallback, useEffect, useState } from 'react'
import {
  LearnDevelopScreen as SharedLearnDevelopScreen,
  LEARN_DEVELOP_ENTRY_SPECS,
  type LearnDevelopEntry,
  type LearnDevelopEntryId,
  type LearnDevelopScreenProps,
} from '@ihui/rn-app'
import type { LearnDevelopCourseCard } from '@ihui/types'
import { Rocket, BookOpen, Brain, Compass, GraduationCap } from 'lucide-react-native'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// M4 api-B:入口文案/顺序/跳转 target 已收进共享数据层(@ihui/rn-app);端侧只注入图标。
const ENTRY_ICONS: Record<LearnDevelopEntryId, LearnDevelopEntry['icon']> = {
  coursePlanet: Rocket,
  studyPlan: BookOpen,
  knowledgePlanet: Brain,
  studyIndex: Compass,
  learnCenter: GraduationCap,
}

const ENTRIES = (
  onNavigate: LearnDevelopScreenProps['onNavigate'],
  t: (k: string) => string,
): LearnDevelopEntry[] =>
  LEARN_DEVELOP_ENTRY_SPECS.map((spec) => ({
    icon: ENTRY_ICONS[spec.id],
    title: t(spec.titleKey),
    desc: t(spec.descKey),
    onPress: () => onNavigate(spec.target),
  }))

/** 后端 GET /content/course/list 的行(与小程序端 api.getCourseList 同投影) */
interface CourseRow {
  id: string | number
  title: string
  coverUrl?: string
  teacher?: string
  price?: number | null
}

export function LearnDevelopScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { onNavigate } = useHostPorts()

  // 2026-11-19:补推荐课程区(守门 296:本来这条壳没有任何可重试的数据面 ⇒ 共享屏的
  // ErrorState 永远拿不到真 onRetry)。与小程序端 `pkg-learn/learn-develop/index.tsx`
  // 同形:同端点、同 4 态、同 retry = 重拉。
  const [courses, setCourses] = useState<LearnDevelopCourseCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadCourses = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetchApi<{ list: CourseRow[] }>('/content/course/list?page=1&pageSize=5')
      const rows = res.success ? (res.data?.list ?? []) : []
      setCourses(
        rows.map((row) => ({
          id: String(row.id),
          title: row.title,
          coverUrl: row.coverUrl,
          teacher: row.teacher,
          price: row.price ?? null,
        })),
      )
    } catch {
      setCourses([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  // 直接联系李总 → 创客名片页(对齐原项目 learn_develop showDetails → /pages/carte/index)
  const onContact = () => {
    onNavigate('Carte')
  }

  const courseSection =
    loading && courses.length === 0
      ? 'loading'
      : error && courses.length === 0
        ? 'error'
        : courses.length === 0
          ? 'empty'
          : 'ready'

  const props: LearnDevelopScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    onContact,
    entries: ENTRIES(onNavigate, t),
    entriesTitle: t('learnDevelop.pathTitle'),
    coursesTitle: t('learnDevelop.recommend'),
    courses,
    coursesSection: courseSection,
    onRetry: () => void loadCourses(),
    colorScheme: resolvedTheme,
    onNavigate,
  }

  return <SharedLearnDevelopScreen {...props} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
