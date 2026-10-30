// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { getKnowledgeBaseArticle } from '@ihui/api-client'
import {
  KnowledgeBaseArticleScreen as SharedKnowledgeBaseArticleScreen,
  type KnowledgeBaseArticleView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'

/** 本屏参数(集成方在 RootStackParamList 补 `KnowledgeBaseArticle: { id: string }`) */
type KnowledgeBaseParamList = { KnowledgeBaseArticle: { id: string } }
type RouteProps = RouteProp<KnowledgeBaseParamList, 'KnowledgeBaseArticle'>
type NavigationProp = { goBack: () => void }

/**
 * RN 端「知识库文章详情」薄壳 —— 承载 web /knowledge-base/[id]。
 * 渲染全部委托共享屏,本文件只管:
 *  - 取数 GET /api/knowledge-base/:id(契约 apps/api/src/routes/other/knowledge-base-routes.ts:130-145,
 *    信封 success({ item }) 在 :144;畸形 id 400、未命中 404 见 :138);
 *  - 日期 Intl 格式化(与 web 同参 locale + year:'numeric' + month:'long' + day:'numeric',
 *    apps/web/app/(main)/knowledge-base/[id]/PageClient.tsx:49-53);
 *  - 404 → 空态「文章不存在」(共享屏 notFound),其余失败 → 错误态 + 重试。
 * 口径差:后端 detail 只返回 knowledge_base 全列,不含 categoryName/authorName/tags/prev/next,
 * 故这三处留空、翻页导航不渲染(web 同字段来自 { article, prev, next } 信封,后端并未提供)。
 */
export function KnowledgeBaseArticleScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProps>()

  const id = route.params?.id ?? ''
  const [article, setArticle] = useState<KnowledgeBaseArticleView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    [locale],
  )

  const load = useCallback(async () => {
    if (!id) {
      setArticle(null)
      setError(null)
      return
    }
    setLoading(true)
    try {
      const res = await getKnowledgeBaseArticle(id)
      if (!res.success || !res.data?.item) {
        if (res.success || res.status === 404) {
          setArticle(null)
          setError(null)
        } else {
          setError(res.error || t('common.loadFailed'))
        }
        return
      }
      setError(null)
      const item = res.data.item
      const d = item.updatedAt ? new Date(item.updatedAt) : null
      setArticle({
        title: item.title,
        summary: item.summary ?? null,
        content: item.content ?? '',
        categoryName: null,
        authorName: null,
        updatedText: d && !Number.isNaN(d.getTime()) ? dateFmt.format(d) : '-',
        viewCount: item.viewCount ?? 0,
        tags: [],
      })
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, dateFmt, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedKnowledgeBaseArticleScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      article={article}
      onRetry={() => void load()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
