// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  KnowledgeEntryReadingScreen as SharedKnowledgeEntryReadingScreen,
  type KnowledgeEntryArticle,
  type KnowledgeEntryNavItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'KnowledgeEntryReading'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 后端 `GET /api/knowledge-base/:id` 的两种回包形态(见下)共用的裸行形状:
 * 字段名对齐 `knowledge_base` 表列(coverImage/categoryId/authorId/isPublished/status
 * 本屏不渲染,故不声明),`article` / `item` 两条通道都能套。
 */
interface KbRawEntry {
  id?: string | number
  title?: string
  summary?: string | null
  content?: string | null
  categoryName?: string | null
  authorName?: string | null
  tags?: string[] | null
  viewCount?: number | null
  updatedAt?: string | null
}

/**
 * 端点回包 —— **两种形态都要认**:
 *  - `{ article, prev, next }`:工单与 web `PageClient.tsx` 的读法(目标契约);
 *  - `{ item }`:apps/api/src/routes/other/knowledge-base-routes.ts:129-145 的**现网实回**
 *    (`success({ item })`,裸表行,无 prev/next)。
 * 只认其中一种就会在另一种上整屏空白,所以这里按「先 article 后 item」归一,
 * 缺的 prev/next 就当真没有(不编造上一篇/下一篇)。
 */
interface KbDetailPayload {
  article?: KbRawEntry | null
  item?: KbRawEntry | null
  prev?: KnowledgeEntryNavItem | null
  next?: KnowledgeEntryNavItem | null
}

function toArticle(raw: KbRawEntry): KnowledgeEntryArticle {
  return {
    id: String(raw.id ?? ''),
    title: raw.title ?? '',
    summary: raw.summary ?? null,
    content: raw.content ?? '',
    // 后端只回 categoryId / authorId,没有名字列 ⇒ 没有就是 null,不拿 id 冒充名称
    categoryName: raw.categoryName ?? null,
    authorName: raw.authorName ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    viewCount: typeof raw.viewCount === 'number' ? raw.viewCount : 0,
    updatedAt: raw.updatedAt ?? null,
  }
}

/**
 * 知识库条目阅读页 —— RN 宿主壳,对齐 web `/knowledge-base/[id]`。
 * 取数 + 导航在此,渲染全在共享屏 `@ihui/rn-app` 的 KnowledgeEntryReadingScreen。
 */
export function KnowledgeEntryReadingScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params

  const [article, setArticle] = useState<KnowledgeEntryArticle | null>(null)
  const [prev, setPrev] = useState<KnowledgeEntryNavItem | null>(null)
  const [next, setNext] = useState<KnowledgeEntryNavItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<KbDetailPayload>(`/api/knowledge-base/${encodeURIComponent(id)}`)
      if (!res.success) {
        setArticle(null)
        setPrev(null)
        setNext(null)
        setError(apiFailureToText(res, t('knowledgeBase.readingLoadFailed')))
        return
      }
      const raw = res.data?.article ?? res.data?.item ?? null
      setArticle(raw ? toArticle(raw) : null)
      setPrev(res.data?.prev ?? null)
      setNext(res.data?.next ?? null)
    } catch {
      setArticle(null)
      setPrev(null)
      setNext(null)
      setError(t('knowledgeBase.readingLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedKnowledgeEntryReadingScreen
      t={t}
      article={article}
      prev={prev}
      next={next}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onRetry={() => void load()}
      // 换条目走 push:保持返回栈能一路退回列表,而不是在同一屏上原地换参
      onPrev={(item) => navigation.push('KnowledgeEntryReading', { id: item.id })}
      onNext={(item) => navigation.push('KnowledgeEntryReading', { id: item.id })}
      colorScheme={resolvedTheme}
    />
  )
}
