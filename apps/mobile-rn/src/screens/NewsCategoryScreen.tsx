// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getNewsArticles, getNewsCategories } from '@ihui/api-client'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import {
  NewsCategoryScreen as SharedNewsCategoryScreen,
  type NewsCategoryArticleRow,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本票路由由 manifest 交集成方统一注册(禁改 RootNavigator),本地交叉类型补齐。 */
type ShellParams = RootStackParamList & {
  NewsCategory: { id: string }
}
type NavigationProp = NativeStackNavigationProp<ShellParams>
type CategoryRoute = RouteProp<ShellParams, 'NewsCategory'>

/** 与 web 同参:PAGE_SIZE=20(PageClient.tsx:55) */
const PAGE_SIZE = 20

function toAbsolute(uri: string): string {
  if (/^https?:\/\//i.test(uri)) return uri
  return `${API_BASE_URL.replace(/\/$/, '')}${uri.startsWith('/') ? '' : '/'}${uri}`
}

/**
 * RN 端「资讯分类」薄壳 —— 承载 web /news/category/[id]。渲染全部委托共享屏,本文件只管:
 * 分类目录(GET /api/news/categories)与分类文章分页(GET /api/news/articles?page&pageSize&categoryId,
 * 与 web 逐字同参)、coverImage 相对路径解析、Intl 日期(formatDateOnly,与 web 同一 shared 出口)。
 * 降级说明:RN 无资讯详情路由(NewsDetail 不存在)⇒ 条目只读展示(共享屏头注与本票 ledger 如实记录)。
 */
export function NewsCategoryScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<CategoryRoute>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const categoryId = route.params?.id ?? ''

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [articles, setArticles] = useState<NewsCategoryArticleRow[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articlesError, setArticlesError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await getNewsCategories()
        if (!alive) return
        if (!res.success || !res.data) {
          setCategoriesError(res.error ?? t('newsCategoryPage.error'))
          return
        }
        setCategoriesError(null)
        setCategories((res.data.list ?? []).map((c) => ({ id: c.id, name: c.name })))
      } catch {
        if (alive) setCategoriesError(t('newsCategoryPage.error'))
      } finally {
        if (alive) setCategoriesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [t])

  useEffect(() => {
    if (!categoryId) return
    let alive = true
    setArticlesLoading(true)
    void (async () => {
      try {
        const res = await getNewsArticles({ page, pageSize: PAGE_SIZE, categoryId })
        if (!alive) return
        if (!res.success || !res.data) {
          setArticlesError(res.error ?? t('newsCategoryPage.error'))
          return
        }
        setArticlesError(null)
        setTotal(res.data.total ?? 0)
        setArticles(
          (res.data.list ?? []).map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary ?? null,
            coverUri: a.coverImage ? toAbsolute(a.coverImage) : null,
            pinned: Boolean(a.isPinned),
            authorName: a.authorName ?? null,
            dateText: formatDateOnly(a.publishedAt),
            viewText: t('newsCategoryPage.viewCount', { count: a.viewCount }),
          })),
        )
      } catch {
        if (alive) setArticlesError(t('newsCategoryPage.error'))
      } finally {
        if (alive) setArticlesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [categoryId, page, t])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), [])
  const nextPage = useCallback(() => setPage((p) => (p >= totalPages ? p : p + 1)), [totalPages])

  const category = categories.find((c) => c.id === categoryId) ?? null

  return (
    <SharedNewsCategoryScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.navigate('News')}
      categoriesLoading={categoriesLoading}
      categoriesError={categoriesError}
      categoryName={category?.name ?? null}
      articlesLoading={articlesLoading}
      articlesError={articlesError}
      articles={articles}
      total={total}
      page={page}
      totalPages={totalPages}
      onPrevPage={prevPage}
      onNextPage={nextPage}
    />
  )
}

export default NewsCategoryScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
