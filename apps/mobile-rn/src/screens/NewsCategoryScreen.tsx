// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<<<<<<< HEAD
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getNews } from '@ihui/api-client'
import { apiFailureToText, toUserFriendlyMessage } from '@ihui/shared/utils'
import {
  NewsCategoryScreen as SharedNewsCategoryScreen,
  type NewsCategoryArticle,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'NewsCategory'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** `GET /api/news/categories` 的裸行(news_categories 表:id/name/sort/status/createdAt) */
interface RawCategory {
  id?: string | number
  name?: string | null
}

/**
 * `GET /api/news/articles?categoryId=` 的裸行(news_articles 表 + join 出的 categoryName)。
 * 只声明本屏真正渲染的列,其余(content/likeCount/status…)不取。
 */
interface RawArticle {
  id?: string | number
  title?: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  viewCount?: number | null
  publishedAt?: string | null
  isPinned?: boolean | null
}

interface CategoriesPayload {
  list?: RawCategory[] | null
}

const PAGE_SIZE = 20

/** db 行 → 共享屏条目:缺列一律如实留空,不拿 id 冒充名称、不补假时间 */
function toArticle(raw: RawArticle): NewsCategoryArticle {
  return {
    id: String(raw.id ?? ''),
    title: raw.title ?? '',
    summary: raw.summary ?? null,
    coverImage: raw.coverImage ?? null,
    authorName: raw.authorName ?? null,
    viewCount: typeof raw.viewCount === 'number' ? raw.viewCount : 0,
    publishedAt: raw.publishedAt ?? null,
    isPinned: raw.isPinned === true,
  }
}

/**
 * 详情路由 NewsArticle 由「资讯详情」同批票注册(RootNavigator 在本切片禁改清单内)。
 * 这里用窄接口断言只绕过「参数表尚未登记」的 TS2345,运行期调用的路由名与参数
 * 与票面契约逐字一致;该票落盘后可直接改回 `navigation.navigate('NewsArticle', { id })`。
 */
type NewsDetailNavigation = { navigate: (name: 'NewsArticle', params: { id: string }) => void }

/**
 * 资讯分类列表页 —— RN 宿主壳,对齐 web `/news/category/[id]`。
 *
 * 取数与导航在此,渲染全在共享屏 `@ihui/rn-app` 的 NewsCategoryScreen:
 *  - `GET /api/news/categories` 解析 id→name(web `PageClient.tsx:63-71` 同源);
 *  - `GET /api/news/articles?categoryId=` 取该分类文章(web `PageClient.tsx:73-83` 同源);
 *  - 点击文章 → 资讯详情。
 *
 * ⚠️ 参数名:`packages/api-client` 的 `NewsListQuery` 曾只声明 `category`,而后端
 * `articlesQuerySchema`(apps/api/src/routes/news.ts:56-66)只认 `categoryId` —— 传旧键会被 Zod
 * 丢掉、静默返回**全站**文章。2026-10-28 起该类型已补 `categoryId`(真实键),本屏直接用它;
 * 旧的 `category` 键保留声明只为不打断别的调用方,新代码不要再用。
 *
 * 分类接口没有 apiClient 封装(全仓仅 admin 侧有 `/api/admin/news/categories`),
 * 与 KnowledgeEntryReading 宿主同口径直接 `fetchApi`。
 */
export function NewsCategoryScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params

  const [categoryName, setCategoryName] = useState<string | null>(null)
  const [items, setItems] = useState<NewsCategoryArticle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  /** 分类 id→name;失败返回 false(调用方据此给出错误文案,而不是把「查不到」当「不存在」) */
  const loadCategoryName = useCallback(async (): Promise<boolean> => {
    const res = await fetchApi<CategoriesPayload>('/api/news/categories')
    if (!res.success || !res.data) return false
    const found = (res.data.list ?? []).find((c) => String(c.id ?? '') === id)
    setCategoryName(found?.name ?? null)
    return true
  }, [id])

  /** 取某一页文章;失败返回 null 并落 error,成功返回归一后的条目 */
  const loadPage = useCallback(
    async (targetPage: number): Promise<NewsCategoryArticle[] | null> => {
      const res = await getNews({ page: targetPage, pageSize: PAGE_SIZE, categoryId: id })
      if (!res.success || !res.data) {
        setError(apiFailureToText(res, t('news.categoryLoadFailed')))
        return null
      }
      const rawList = (res.data.list ?? []) as unknown as RawArticle[]
      setTotal(typeof res.data.total === 'number' ? res.data.total : rawList.length)
      return rawList.map(toArticle)
    },
    [id, t],
  )

  const load = useCallback(
    async (mode: 'first' | 'refresh') => {
      if (mode === 'first') setLoading(true)
      else setRefreshing(true)
      setError('')
      try {
        if (mode === 'first') {
          const ok = await loadCategoryName()
          // 分类名取不到时给错误文案:屏上会退化成通用标题,不能让用户以为进了错分类
          if (!ok) setError(t('news.categoryLoadFailed'))
        }
        const list = await loadPage(1)
        if (list) {
          setItems(list)
          setPage(1)
          // 首屏成功即清掉分类接口留下的错误(文章能出来就说明页面可用)
          setError('')
        } else if (mode === 'first') {
          setItems([])
        }
      } catch (e: unknown) {
        const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
        setError(detail.trim() ? toUserFriendlyMessage(e) : t('news.categoryLoadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [loadCategoryName, loadPage, t],
  )

  useEffect(() => {
    void load('first')
  }, [load])

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMore) return
    if (items.length >= total) return
    setLoadingMore(true)
    void (async () => {
      try {
        const nextPage = page + 1
        const list = await loadPage(nextPage)
        if (list && list.length > 0) {
          setItems((prev) => [...prev, ...list])
          setPage(nextPage)
        }
      } catch {
        // 追页失败不清首屏:已加载内容保持可读,下拉刷新可重试
      } finally {
        setLoadingMore(false)
      }
    })()
  }, [loading, refreshing, loadingMore, items.length, total, page, loadPage])

  const handleSelect = useCallback(
    (articleId: string) => {
      ;(navigation as unknown as NewsDetailNavigation).navigate('NewsArticle', { id: articleId })
    },
    [navigation],
  )
=======
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
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe

  return (
    <SharedNewsCategoryScreen
      t={t}
<<<<<<< HEAD
      categoryName={categoryName}
      items={items}
      total={total}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      hasMore={items.length < total}
      error={error}
      onBack={() => navigation.goBack()}
      onRefresh={() => void load('refresh')}
      onRetry={() => void load('first')}
      onLoadMore={handleLoadMore}
      onSelect={handleSelect}
      colorScheme={resolvedTheme}
    />
  )
}
=======
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
