/**
 * KBArticleDetailScreen 知识库文章阅读(mobile-rn 端 wrapper)
 *
 * 2026-10-26 承载 web `/knowledge-base/[id]`
 * (apps/web/app/(main)/knowledge-base/[id]/PageClient.tsx:46 GET `/api/knowledge-base/${id}`)。
 * UI 与展示逻辑住在共享层 @ihui/rn-app KBArticleDetailScreen,本 wrapper 只承担平台职责:
 * - 数据:getKBArticle(id) → 后端 `{ item }`(knowledge-base-routes.ts:144;
 *   **不是** web 读的 `{ article }`,web 那侧的类型声明与真接口不符)
 * - 时间:按 web 逐字同参 Intl.DateTimeFormat(locale, { year:'numeric', month:'long', day:'numeric' })
 *   预格式化为展示文本注入共享屏(共享层不碰 locale)
 * - 副作用如实提示:后端 :140-143 每次命中都 viewCount + 1,故本屏只在进入时取一次,
 *   重试按钮复用同一次取数语义(会再加一次浏览量,与 web 刷新同行为)
 * - 导航:返回 goBack;标题取路由参数(web 直接从文章渲染,无独立标题参数)
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getKBArticle } from '@ihui/api-client'
import type { KBArticleDetailView } from '@ihui/rn-app'
import { KBArticleDetailScreen as SharedKBArticleDetailScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端错误文案直接呈现(对齐 web :79 `(error as Error)?.message`),不另造兜底文案 */
function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message || String(e)
  return String(e)
}

export function KBArticleDetailScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  const id = (route.params as { id?: string } | undefined)?.id ?? ''

  const [article, setArticle] = useState<KBArticleDetailView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      setError(t('kbArticleDetailPage.notFound'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const item = await getKBArticle(id)
      setArticle({
        id: item.id,
        title: item.title,
        summary: item.summary ?? null,
        content: item.content ?? null,
        viewCount: item.viewCount ?? null,
        updatedAt: item.updatedAt ?? null,
      })
    } catch (e) {
      setError(toMessage(e))
      setArticle(null)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  // 与 web :49-58 同参同兜底:非法时间一律 '-'
  const updatedText = (() => {
    const v = article?.updatedAt
    if (!v) return '-'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
  })()

  return (
    <SharedKBArticleDetailScreen
      t={t}
      article={article}
      loading={loading}
      error={error}
      updatedText={updatedText}
      onRetry={() => void load()}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
