// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 课程筛选屏(端内取数 + 轴状态;展示件是共享屏 `packages/app/.../course-filter`)。
 *
 * G-469 的端到端契约(`apps/mobile-rn/tests/g-469-course-filter-axis-e2e.test.tsx`)把本屏的
 * 职责钉死在这四条上,任何一条退回去都会让那组用例变成"恒渲染 N 行"的空转:
 *
 *  1. **轴走服务端**:price / difficulty / categoryId 必须进请求(服务端 `lessonFilterConditions`
 *     只认这三根 + search),端内不许再把已取回的一页做二次过滤(旧版就是这么写的,
 *     `CourseFilterItem.price` 现在是 number、且多了 difficulty/categoryName 两列,旧映射根本对不上)。
 *  2. **草稿档 ≠ 已应用档**:点档位只改草稿;点「应用」才把草稿落成已应用档 ⇒ 请求参数变化 ⇒
 *     hook 的 fetcher 身份变化 ⇒ 重取第 1 页。这么拆是为了让「应用」真的有事做,也让
 *     "只点不应用"严格不发新请求。
 *  3. **分类轴直取服务端**:`GET /api/learn/categories` 的真实行(中文 name + UUID id),
 *     端内不硬编码分类名;取不到就传空数组,由共享屏如实提示"当前没有可用分类"。
 *  4. **分页由服务端**:触底走 `loadMore` 取下一页,不再"只拿第一页然后端内过滤"。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLearnCategories, getLearnCourses, type LearnCourse } from '@ihui/api-client'
import { CourseFilterScreen as SharedCourseFilterScreen, type CourseFilterItem } from '@ihui/rn-app'
import type {
  CourseDifficultyFilter,
  CourseFilterCategoryOption,
  CoursePriceFilter,
} from '@ihui/types'
import { priceOf, type LessonPriceRow } from '../lib/course-filter-price'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20
/** 分类轴的"未选"哨兵(与共享屏的 ALL_CATEGORIES 同值);服务端只认真实分类 UUID */
const ALL = 'all'

export function CourseFilterScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  // 草稿档(点档位改它)/ 已应用档(点「应用」才落)。请求只认已应用档。
  const [draftPrice, setDraftPrice] = useState<CoursePriceFilter>(ALL)
  const [appliedPrice, setAppliedPrice] = useState<CoursePriceFilter>(ALL)
  const [draftDifficulty, setDraftDifficulty] = useState<CourseDifficultyFilter>(ALL)
  const [appliedDifficulty, setAppliedDifficulty] = useState<CourseDifficultyFilter>(ALL)
  // 分类轴在共享屏契约里是单值 + 直改(没有草稿对),所以它一改即生效 ——
  // 这不是"绕过应用":契约有意把它与价格/难度两种节奏分开(分类是导航级选择,不是条件微调)。
  const [categoryId, setCategoryId] = useState<string>(ALL)
  const [categories, setCategories] = useState<CourseFilterCategoryOption[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getLearnCategories()
      if (cancelled || !res.success) return
      // 只留 id/name:共享屏只要这两个字段,终端的 sort/pid 不该漏到展示层
      setCategories(res.data.map((row) => ({ id: row.id, name: row.name })))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 三根轴:已应用档不是 'all' 才下传('all' 由"不下传该参数"表达,服务端把 absent 当全量)
  const fetcher = useCallback(
    async (query: { page: number; pageSize: number }) => {
      const res = await getLearnCourses({
        page: query.page,
        pageSize: query.pageSize,
        ...(appliedPrice === ALL ? {} : { price: appliedPrice }),
        ...(appliedDifficulty === ALL ? {} : { difficulty: appliedDifficulty }),
        ...(categoryId === ALL ? {} : { categoryId }),
      })
      if (!res.success) return { success: false as const, error: t('courseFilter.loadFailed') }
      const list = res.data?.list ?? []
      return {
        success: true as const,
        data: { list, total: res.data?.total ?? list.length },
      }
    },
    [appliedPrice, appliedDifficulty, categoryId, t],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePaginatedList<LearnCourse>(fetcher, PAGE_SIZE)

  const apply = () => {
    setAppliedPrice(draftPrice)
    setAppliedDifficulty(draftDifficulty)
  }

  const reset = () => {
    setDraftPrice(ALL)
    setAppliedPrice(ALL)
    setDraftDifficulty(ALL)
    setAppliedDifficulty(ALL)
    setCategoryId(ALL)
  }

  const filterItems: CourseFilterItem[] = useMemo(
    () =>
      items.map((row) => ({
        id: row.id,
        title: row.title,
        instructor: row.instructor ?? '',
        // price 在服务端是 numeric → 字符串,本屏统一交给 priceOf 折成数字(0 元即免费)
        price: priceOf(row as LessonPriceRow),
        // NULL(未标注)保真:不用任何默认档把"未标注"洗成"入门"
        difficulty: row.difficulty ?? null,
        categoryName: row.categoryName ?? null,
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
      priceTab={draftPrice}
      onPriceTabChange={setDraftPrice}
      difficultyTab={draftDifficulty}
      onDifficultyTabChange={setDraftDifficulty}
      categories={categories}
      categoryId={categoryId}
      onCategoryChange={setCategoryId}
      onLoadMore={loadMore}
      onApply={apply}
      onReset={reset}
      onRefresh={refresh}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
