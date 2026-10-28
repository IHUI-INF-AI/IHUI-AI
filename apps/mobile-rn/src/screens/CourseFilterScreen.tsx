// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLearnCategories, getLearnCourses, type LearnCategoryRow } from '@ihui/api-client'
import { CourseFilterScreen as SharedCourseFilterScreen, type CourseFilterItem } from '@ihui/rn-app'
import {
  DEFAULT_COURSE_FILTER_AXES,
  buildCourseFilterQuery,
  priceOf,
  type CourseFilterAxes,
  type LessonPriceRow,
} from '../lib/course-filter-price'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

export function CourseFilterScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  // 草稿 = 屏幕上按下去的档;已应用 = 已经交给服务端的那一组。
  // 分开不是为了仪式感:三根轴各点一次就发三次请求,而用户想看的是"**这一组**条件"的结果。
  const [draft, setDraft] = useState<CourseFilterAxes>(DEFAULT_COURSE_FILTER_AXES)
  const [applied, setApplied] = useState<CourseFilterAxes>(DEFAULT_COURSE_FILTER_AXES)

  /**
   * 分类轴的选项**只能来自服务端**(GET /api/learn/categories:中文 name + UUID id)。
   * 失败或空集就留空数组 —— 共享屏会把这一轴渲染成一句如实提示,而不是造一个
   * "看起来能点、点了不会怎样"的假选项。
   */
  const [categories, setCategories] = useState<LearnCategoryRow[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getLearnCategories()
      if (!cancelled && res.success) setCategories(res.data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 筛选轴由服务端实现:每次取数都把「已应用」的那一组条件带上(不再"取一页回来在端内过滤")。
  // applied 换了对象 ⇒ fetcher 换了身份 ⇒ usePaginatedList 的 effect 自动重取第一页。
  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await getLearnCourses(buildCourseFilterQuery(applied, page, pageSize))
      if (!res.success) return { success: false as const, error: t('courseFilter.loadFailed') }
      const list = (res.data?.list ?? []) as LessonPriceRow[]
      return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
    },
    [applied, t],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePaginatedList<LessonPriceRow>(fetcher, PAGE_SIZE)

  const filterItems: CourseFilterItem[] = useMemo(
    () =>
      items.map((c) => ({
        id: c.id,
        title: c.title,
        instructor: c.instructor ?? '',
        price: priceOf(c),
        // 服务端未标注(NULL)就照 NULL 交下去,共享屏那一行整行不渲染 —— 不得填一个默认档
        difficulty: c.difficulty ?? null,
        categoryName: c.categoryName ?? null,
      })),
    [items],
  )

  return (
    <SharedCourseFilterScreen
      t={t}
      items={filterItems}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      error={error}
      priceTab={draft.price}
      onPriceTabChange={(p) => setDraft((prev) => ({ ...prev, price: p }))}
      difficultyTab={draft.difficulty}
      onDifficultyTabChange={(d) => setDraft((prev) => ({ ...prev, difficulty: d }))}
      categories={categories}
      categoryId={draft.categoryId}
      onCategoryChange={(id) => setDraft((prev) => ({ ...prev, categoryId: id }))}
      // 触底取下一页:此前这条屏**从不请求第 2 页**(FlatList 没有 onEndReached,
      // usePaginatedList 的 loadMore 无触发点),所以"total=40 却只看得到 20 条"是常态。
      onLoadMore={loadMore}
      onApply={() => setApplied(draft)}
      onReset={() => {
        setDraft(DEFAULT_COURSE_FILTER_AXES)
        setApplied(DEFAULT_COURSE_FILTER_AXES)
      }}
      onRefresh={refresh}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
