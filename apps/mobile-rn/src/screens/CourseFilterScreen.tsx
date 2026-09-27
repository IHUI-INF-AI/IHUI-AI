// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLearnCourses } from '@ihui/api-client'
import { CourseFilterScreen as SharedCourseFilterScreen, type CourseFilterItem } from '@ihui/rn-app'
import {
  matchesPriceTab,
  priceOf,
  type CoursePriceTab,
  type LessonPriceRow,
} from '../lib/course-filter-price'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type PriceTab = CoursePriceTab

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
    const list = (res.data?.list ?? []) as LessonPriceRow[]
    return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
  }, [t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<LessonPriceRow>(
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
        .filter((c) => matchesPriceTab(priceOf(c), appliedTab))
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
