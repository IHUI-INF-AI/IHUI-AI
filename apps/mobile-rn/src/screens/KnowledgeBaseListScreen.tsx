// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  KnowledgeBaseListScreen as SharedKnowledgeBaseListScreen,
  type KnowledgeBaseCategoryItem,
  type KnowledgeBaseListItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

/**
 * `GET /api/knowledge-base` 的裸行(apps/api/src/routes/other/knowledge-base-routes.ts:33-83):
 * 左连 category 与 users 后回 `{ id, title, summary, viewCount, updatedAt, categoryId,
 * categoryName, authorName }` —— 后两者可空(左连不到就是 null),端上按「没有就不渲染」处理。
 */
interface KbRawRow {
  id?: string | number
  title?: string | null
  summary?: string | null
  updatedAt?: string | null
  categoryName?: string | null
  authorName?: string | null
}

interface KbListPayload {
  list?: KbRawRow[] | null
  total?: number
}

interface KbCategoriesPayload {
  list?: { id?: string | number; name?: string | null; count?: number | null }[] | null
}

function toItem(raw: KbRawRow): KnowledgeBaseListItem {
  return {
    id: String(raw.id ?? ''),
    title: raw.title ?? '',
    summary: raw.summary ?? null,
    categoryName: raw.categoryName ?? null,
    authorName: raw.authorName ?? null,
    updatedAt: raw.updatedAt ?? null,
  }
}

/**
 * 知识库文章列表 —— RN 宿主壳,对齐 web `/knowledge-base`。
 *
 * 取数 / 分页 / 搜索去抖后的重取在此,渲染全在共享屏 `@ihui/rn-app` 的 KnowledgeBaseListScreen;
 * 点卡进 `KnowledgeEntryReading`(同域详情,`GET /api/knowledge-base/:id`)。
 *
 * ⚠️ 与 `KnowledgeBaseScreen`(路由 `KnowledgeBase`)**不是同一物**:那个屏列的是
 * `/api/knowledge/docs` 的 RAG 文档(`knowledge_docs` 表),本屏列 `knowledge_base` 表;
 * 两表 id 各自独立,把一边的 id 传给另一边只会 404,不要合并。
 *
 * `categoryId` 的 `'all'` 是后端哨兵值(见 knowledge-base-routes.ts 的 categoryFilterSchema:
 * 非 'all' 时必须是 uuid,畸形值会被 400 直接挡下)⇒ 除 'all' 外一律原样回传后端给的 uuid。
 */
export function KnowledgeBaseListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<KnowledgeBaseListItem[]>([])
  const [categories, setCategories] = useState<KnowledgeBaseCategoryItem[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState('all')
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  /** 竞态守卫:搜索/切分类连点时只认最后一次请求的结果 */
  const requestSeq = useRef(0)

  const load = useCallback(
    async (mode: 'first' | 'refresh' | 'more', target: number) => {
      const seq = requestSeq.current + 1
      requestSeq.current = seq
      const targetPage = target

      if (mode === 'first') setLoading(true)
      else if (mode === 'refresh') setRefreshing(true)
      else setLoadingMore(true)
      setError('')

      const qs = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (activeCategoryId !== 'all') qs.set('categoryId', activeCategoryId)
      if (search) qs.set('search', search)

      try {
        const res = await fetchApi<KbListPayload>(`/api/knowledge-base?${qs.toString()}`)
        if (seq !== requestSeq.current) return
        if (!res.success) {
          // 首屏/刷新失败才顶掉整屏;翻页失败保留已读列表,只收敛加载态
          if (mode !== 'more') {
            setItems([])
            setTotal(0)
            setError(apiFailureToText(res, t('knowledgeBase.loadFailed')))
          }
          return
        }
        const rows = (res.data?.list ?? []).map(toItem).filter((item) => item.id.length > 0)
        setItems((prev) => (mode === 'more' ? [...prev, ...rows] : rows))
        setTotal(typeof res.data?.total === 'number' ? res.data.total : rows.length)
        setPage(targetPage)
      } catch {
        if (seq !== requestSeq.current) return
        if (mode !== 'more') {
          setItems([])
          setTotal(0)
          setError(t('knowledgeBase.loadFailed'))
        }
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
        }
      }
    },
    [activeCategoryId, search, t],
  )

  /** 分类失败不顶整屏:筛选项少一排 ≠ 列表不可用,静默留空(与 web 的 useQuery 默认值同效) */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<KbCategoriesPayload>('/api/knowledge-base/categories')
        if (cancelled || !res.success) return
        setCategories(
          (res.data?.list ?? [])
            .map((c) => ({
              id: String(c.id ?? ''),
              name: c.name ?? '',
              count: typeof c.count === 'number' ? c.count : 0,
            }))
            .filter((c) => c.id.length > 0),
        )
      } catch {
        // 见上:静默
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 首屏 + 每次筛选/搜索生效后重取;翻页由 onLoadMore 单独驱动,不进依赖 */
  useEffect(() => {
    void load('first', 1)
  }, [load])

  const hasMore = items.length < total

  return (
    <SharedKnowledgeBaseListScreen
      t={t}
      items={items}
      categories={categories}
      activeCategoryId={activeCategoryId}
      search={search}
      total={total}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      hasMore={hasMore}
      error={error}
      onBack={() => navigation.goBack()}
      onSelect={(item) => navigation.navigate('KnowledgeEntryReading', { id: item.id })}
      onCategoryChange={(id) => setActiveCategoryId(id)}
      onSearchChange={setSearch}
      onRefresh={() => void load('refresh', 1)}
      onRetry={() => void load('first', 1)}
      onLoadMore={() => void load('more', page + 1)}
      colorScheme={resolvedTheme}
    />
  )
}

export default KnowledgeBaseListScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
