// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLearnCourses, type LearnCourse } from '@ihui/api-client'
import { CourseFilterScreen as SharedCourseFilterScreen, type CourseFilterItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type PriceTab = 'all' | 'free' | 'paid'

/**
 * 后端 GET /api/learn/lessons 的真实行:findPublishedLessons 选整张 lessons 表,
 * adaptLesson 再追加 instructor/description/students/cover。
 * 没有 level —— 该表不存在难度列。
 */
interface LessonRow extends LearnCourse {
  instructor?: string
  price?: string | number
}

/** lessons.price 是 numeric(10,2),Drizzle 回传字符串;非数一律按免费看。 */
function priceOf(row: LessonRow): number {
  const n = typeof row.price === 'string' ? Number(row.price) : row.price
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

const PAGE_SIZE = 20

export function CourseFilterScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [draftTab, setDraftTab] = useState<PriceTab>('all')
  const [appliedTab, setAppliedTab] = useState<PriceTab>('all')

  const fetcher = useCallback(async () => {
    const res = await getLearnCourses({ page: 1, pageSize: PAGE_SIZE })
    if (!res.success) return { success: false as const, error: t('courseFilter.loadFailed') }
    const list = (res.data?.list ?? []) as LessonRow[]
    return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
  }, [t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<LessonRow>(
    fetcher,
    PAGE_SIZE,
  )

  // 服务端只认 page/pageSize/categoryId/search,价格不是它的查询轴 —— 所以「应用」把草稿档落成
  // 已应用档、由本地对已取回的行做过滤。草稿/已应用分开,是为了让「应用」这个按钮真的有事做。
  const applyFilter = () => setAppliedTab(draftTab)

  const reset = () => {
    setDraftTab('all')
    setAppliedTab('all')
  }

  const filterItems: CourseFilterItem[] = useMemo(
    () =>
      items
        .filter((c) =>
          appliedTab === 'all' ? true : appliedTab === 'free' ? priceOf(c) === 0 : priceOf(c) > 0,
        )
        .map((c) => ({
          id: c.id,
          title: c.title,
          instructor: c.instructor ?? '',
          price: priceOf(c),
        })),
    [items, appliedTab],
  )

  return (
    <SharedCourseFilterScreen
      t={t}
      items={filterItems}
      loading={loading}
      refreshing={refreshing}
      error={error}
      priceTab={draftTab}
      onPriceTabChange={setDraftTab}
      onApply={applyFilter}
      onReset={reset}
      onRefresh={refresh}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
