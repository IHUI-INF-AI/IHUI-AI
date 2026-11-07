// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getNewsArticles, getNewsCategories } from '@ihui/api-client'
import {
  NewsCategoryScreen as SharedNewsCategoryScreen,
  type NewsCategoryArticleRow,
} from '@ihui/rn-app/features/community/NewsCategoryScreen'
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

/** 与 web 同参:PAGE_SIZE=20 */
const PAGE_SIZE = 20

function toAbsolute(uri: string): string {
  if (/^https?:\/\//i.test(uri)) return uri
  return `${API_BASE_URL.replace(/\/$/, '')}${uri.startsWith('/') ? '' : '/'}${uri}`
}

/**
 * 「资讯分类」分页薄壳 —— 承接 pkg-mirror/news-category 的声明契约
 * (packages/app/src/features/community/NewsCategoryScreen.tsx:分页模型)。
 *
 * 本文件只做「取数状态 + 事件回调 → 分页契约 prop」的转接:不渲染列表、不复制共享屏
 * 样式/布局,列表呈现与分页器全部由共享屏负责。翻页边界、取词、主题由壳注入。
 *
 * 与老壳 NewsCategoryScreen.tsx 的分工:老壳承接 news 无限滚动契约(pkg-content +
 * RN App),本壳承接 community 分页契约(pkg-mirror);两者互不影响。
 */
export function NewsCategoryPagedScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<CategoryRoute>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()

  const categoryId = route.params?.id ?? ''

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [articles, setArticles] = useState<NewsCategoryArticleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [articlesError, setArticlesError] = useState<string | null>(null)
  /** 请求序号:翻页/换分类竞态时只有最后一枚能落状态 */
  const requestSeq = useRef(0)

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [locale],
  )
  const numberFmt = useMemo(() => new Intl.NumberFormat(locale), [locale])

  const toRow = useCallback(
    (a: {
      id: string
      title: string
      summary?: string | null
      coverImage?: string | null
      isPinned?: boolean
      authorName?: string | null
      viewCount?: number
      publishedAt?: string | null
    }): NewsCategoryArticleRow => ({
      id: a.id,
      title: a.title,
      summary: a.summary ?? null,
      coverUri: a.coverImage ? toAbsolute(a.coverImage) : null,
      pinned: Boolean(a.isPinned),
      authorName: a.authorName ?? null,
      dateText: a.publishedAt ? dateFmt.format(new Date(a.publishedAt)) : '',
      viewText: numberFmt.format(a.viewCount ?? 0),
    }),
    [dateFmt, numberFmt],
  )

  // 分类目录:取不到不判整屏失败 —— 文章接口自带 categoryName,退化成通用标题照常渲染
  useEffect(() => {
    let alive = true
    setCategoriesLoading(true)
    setCategoriesError(null)
    void (async () => {
      try {
        const res = await getNewsCategories()
        if (!alive) return
        if (!res.success || !res.data) {
          setCategoriesError(t('common.loadFailed'))
          return
        }
        setCategories((res.data.list ?? []).map((c) => ({ id: c.id, name: c.name })))
      } catch {
        if (alive) setCategoriesError(t('common.loadFailed'))
      } finally {
        if (alive) setCategoriesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [t])

  const load = useCallback(
    async (pageNo: number) => {
      if (!categoryId) {
        setArticles([])
        setTotal(0)
        setPage(1)
        setArticlesLoading(false)
        return
      }
      const seq = ++requestSeq.current
      setArticlesLoading(true)
      setArticlesError(null)
      try {
        const res = await getNewsArticles({ page: pageNo, pageSize: PAGE_SIZE, categoryId })
        if (seq !== requestSeq.current) return
        if (!res.success || !res.data) {
          setArticlesError(res.error ?? t('news.categoryLoadFailed'))
          return
        }
        setTotal(res.data.total ?? 0)
        setPage(pageNo)
        setArticles((res.data.list ?? []).map(toRow))
      } catch {
        if (seq === requestSeq.current) setArticlesError(t('news.categoryLoadFailed'))
      } finally {
        if (seq === requestSeq.current) setArticlesLoading(false)
      }
    },
    [categoryId, t, toRow],
  )

  useEffect(() => {
    // 换分类 = 从头来:先清空已加载的行,否则上一分类的内容会黏在屏幕上
    setArticles([])
    setTotal(0)
    setPage(1)
    setArticlesError(null)
    void load(1)
  }, [load])

  const categoryName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name ?? null,
    [categories, categoryId],
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const onPrevPage = useCallback(() => {
    if (articlesLoading || page <= 1) return
    void load(page - 1)
  }, [articlesLoading, load, page])

  const onNextPage = useCallback(() => {
    if (articlesLoading || page >= totalPages) return
    void load(page + 1)
  }, [articlesLoading, load, page, totalPages])

  return (
    <SharedNewsCategoryScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.navigate('News')}
      categoriesLoading={categoriesLoading}
      categoriesError={categoriesError}
      categoryName={categoryName}
      articlesLoading={articlesLoading}
      articlesError={articlesError}
      articles={articles}
      total={total}
      page={page}
      totalPages={totalPages}
      onPrevPage={onPrevPage}
      onNextPage={onNextPage}
    />
  )
}
