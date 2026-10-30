// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getNewsArticles, getNewsCategories } from '@ihui/api-client'
import {
  NewsCategoryScreen as SharedNewsCategoryScreen,
  type NewsCategoryArticle,
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
 * RN 端「资讯分类」薄壳 —— 承载 web /news/category/[id]。渲染全部委托共享屏
 * (`packages/app/src/features/news/NewsCategoryScreen.tsx`),本文件只管三件事:
 *
 * 1. 分类目录(`GET /api/news/categories`)→ 只用于 id→name 解析(文章行自带 categoryName);
 * 2. 分类文章(`GET /api/news/articles?page&pageSize&categoryId`,与 web 逐字同参)
 *    → 归一成共享屏的 `NewsCategoryArticle`,coverImage 相对路径绝对化;
 * 3. 翻页方式换成**上拉追加**(web 是 `?page=` 翻页;RN 无地址栏,共享屏设计即为无限滚动)。
 *
 * ⚠️ 2026-10-30 契约修正:此前这里误接了 `NewsCategoryArticleRow`(community 分类屏的
 * 预格式化行类型:coverUri/pinned/dateText/viewText)并传了 page/totalPages/onPrevPage/
 * onNextPage 一套分页 props。共享屏已改为 `items/loading/error/onLoadMore/hasMore` 且
 * **自己**格式化日期与阅读数(news 屏 :212/:217)。两套契约零交集 ⇒ 属性全被忽略、
 * items 恒空,整屏只显示「共 0 篇」。现按 news 屏的真实契约接回。
 *
 * 降级说明:RN 无资讯详情路由(RootNavigator 无 NewsDetail)⇒ onSelect 为空实现,
 * 条目只读展示;要接详情需先在 manifest 注册路由,不属本文件职责。
 */
export function NewsCategoryScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<CategoryRoute>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const categoryId = route.params?.id ?? ''

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  /** 分类目录是否已定局(成功/失败都算):未定局时不能判「资讯不存在」 */
  const [categoriesReady, setCategoriesReady] = useState(false)
  const [articles, setArticles] = useState<NewsCategoryArticle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  /** 请求序号:翻页/刷新竞态时只有最后一枚能落状态(先发的晚回不许覆盖) */
  const requestSeq = useRef(0)

  // 分类目录:取不到不判整屏失败 —— 文章接口自带 categoryName,退化成通用标题照常渲染列表
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await getNewsCategories()
        if (!alive) return
        if (res.success && res.data) {
          setCategories((res.data.list ?? []).map((c) => ({ id: c.id, name: c.name })))
        }
      } catch {
        // 静默降级,见上
      } finally {
        if (alive) setCategoriesReady(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const load = useCallback(
    async (pageNo: number, mode: 'first' | 'refresh' | 'more') => {
      if (!categoryId) {
        setLoading(false)
        return
      }
      const seq = ++requestSeq.current
      if (mode === 'more') setLoadingMore(true)
      else if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      try {
        const res = await getNewsArticles({ page: pageNo, pageSize: PAGE_SIZE, categoryId })
        // 过期响应(期间又换了页/换了分类)一律丢弃,不写任何状态
        if (seq !== requestSeq.current) return
        if (!res.success || !res.data) {
          setError(res.error ?? t('news.categoryLoadFailed'))
          return
        }
        setError('')
        setTotal(res.data.total ?? 0)
        setPage(pageNo)
        const rows: NewsCategoryArticle[] = (res.data.list ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary ?? null,
          coverImage: a.coverImage ? toAbsolute(a.coverImage) : null,
          isPinned: Boolean(a.isPinned),
          authorName: a.authorName ?? null,
          viewCount: a.viewCount ?? 0,
          publishedAt: a.publishedAt ?? null,
        }))
        setArticles((prev) => (mode === 'more' ? [...prev, ...rows] : rows))
      } catch {
        if (seq === requestSeq.current) setError(t('news.categoryLoadFailed'))
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
        }
      }
    },
    [categoryId, t],
  )

  useEffect(() => {
    // 换分类 = 从头来:先清空已追加的行,否则上一分类的内容会黏在屏幕上
    setArticles([])
    setTotal(0)
    setPage(1)
    setError('')
    void load(1, 'first')
  }, [load])

  const categoryName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name ?? null,
    [categories, categoryId],
  )

  const hasMore = articles.length < total

  const onRefresh = useCallback(() => {
    void load(1, 'refresh')
  }, [load])

  const onLoadMore = useCallback(() => {
    // 三重闸:不在首屏加载 / 不在翻页中 / 确实还有下一页 —— 否则 FlatList 触底会空转
    if (loading || loadingMore || !hasMore) return
    void load(page + 1, 'more')
  }, [hasMore, load, loading, loadingMore, page])

  /**
   * RN 无资讯详情路由 ⇒ 点条目不跳转(见文件头注)。
   * 仍传真函数而非 undefined:共享屏按 `onPress={() => onSelect(item.id)}` 直接调用。
   */
  const onSelect = useCallback(() => {}, [])

  return (
    <SharedNewsCategoryScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.navigate('News')}
      categoryName={categoryName}
      items={articles}
      total={total}
      // 分类目录未定局前不进「资讯不存在」分支(否则目录慢一拍就闪一屏假缺失)
      loading={loading || !categoriesReady}
      refreshing={refreshing}
      loadingMore={loadingMore}
      hasMore={hasMore}
      error={error}
      onRefresh={onRefresh}
      onRetry={onRefresh}
      onLoadMore={onLoadMore}
      onSelect={onSelect}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
