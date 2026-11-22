// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { NewsArticleScreen as SharedNewsArticleScreen, type NewsArticleItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'NewsArticle'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * `GET /api/news/articles/:id` 的裸行形状。
 *
 * 字段名对齐 `news_articles` 表列 + `findArticleById` 的 left join 产物
 * (apps/api/src/db/news-queries.ts:151-161),本屏不渲染的
 * authorId/isPublished/isPinned/sort/status/createdAt/updatedAt 不声明。
 * `tags` 在表里**没有这一列**,但 web 页按逗号串读 —— 这里两种形态都收,
 * 真没有就是空数组,不编标签。
 */
interface NewsRawArticle {
  id?: string
  title?: string
  summary?: string | null
  content?: string | null
  coverImage?: string | null
  authorName?: string | null
  categoryName?: string | null
  viewCount?: number | null
  publishedAt?: string | null
  tags?: string | string[] | null
}

/** 端点实回 `success({ article })`(apps/api/src/routes/news.ts:371) */
interface NewsDetailPayload {
  article?: NewsRawArticle | null
}

/** 标签归一:`tags[]` 与 `"a,b"` 两种形态都认,空串/非字符串一律丢 */
function normalizeTags(raw: NewsRawArticle['tags']): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  return list
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function toArticle(raw: NewsRawArticle): NewsArticleItem {
  return {
    id: String(raw.id ?? ''),
    title: raw.title ?? '',
    summary: raw.summary ?? null,
    content: raw.content ?? '',
    coverImage: raw.coverImage ?? null,
    authorName: raw.authorName ?? null,
    categoryName: raw.categoryName ?? null,
    viewCount: typeof raw.viewCount === 'number' ? raw.viewCount : 0,
    publishedAt: raw.publishedAt ?? null,
    tags: normalizeTags(raw.tags),
    // 后端详情不回交互计数 ⇒ 三个字段**不传**(传 undefined 而非 0,屏上才不渲染假 0)
  }
}

/**
 * 资讯详情页 —— RN 宿主壳,对齐 web `/news/[id]`。
 *
 * 取数 + 导航在此,渲染全在共享屏 `@ihui/rn-app` 的 NewsArticleScreen。
 * ⚠️ 与 `ArticleDetailScreen` 严格区分:那个走 `/api/articles/:id`(社区文章域),
 * 本屏走资讯域 `/api/news/articles/:id`,端点不同、表不同,不得互相借用。
 *
 * 不走 api-client 的 `getNewsById`:它对端点的声明是 `ApiResult<News>`
 * (packages/api-client/src/endpoints/community.ts:224),而实回是 `{ article }` 包裹,
 * 直接调用会把包裹层当文章本身 ⇒ 这里用 fetchApi 按实回声明取数,类型偏差见
 * 补丁 `/tmp/crossend-reg-NewsArticleScreen.md` 末尾「待协调者修」。
 */
export function NewsArticleScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params

  const [article, setArticle] = useState<NewsArticleItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<NewsDetailPayload>(`/api/news/articles/${encodeURIComponent(id)}`)
      if (!res.success) {
        setArticle(null)
        setError(apiFailureToText(res, t('news.loadFailed')))
        return
      }
      const raw = res.data?.article ?? null
      setArticle(raw ? toArticle(raw) : null)
    } catch {
      setArticle(null)
      setError(t('news.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedNewsArticleScreen
      t={t}
      article={article}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onRetry={() => void load()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
