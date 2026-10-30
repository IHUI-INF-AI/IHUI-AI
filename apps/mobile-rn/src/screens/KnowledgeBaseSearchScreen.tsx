// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { getKnowledgeBaseList, type KnowledgeBaseListItem } from '@ihui/api-client'
import {
  KnowledgeBaseSearchScreen as SharedKnowledgeBaseSearchScreen,
  type KnowledgeBaseSearchRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const NS = 'knowledgeBaseSearchPage'

/** web 同值(apps/web/app/(main)/knowledge-base/search/PageClient.tsx:68 pageSize: '50') */
const PAGE_SIZE = 50

/** 本屏参数(集成方在 RootStackParamList 补 `KnowledgeBaseSearch: { q?: string } | undefined`) */
type KnowledgeBaseParamList = { KnowledgeBaseSearch: { q?: string } | undefined }
type RouteProps = RouteProp<KnowledgeBaseParamList, 'KnowledgeBaseSearch'>
type NavigationProp = {
  goBack: () => void
  navigate: (name: 'KnowledgeBaseArticle', params: { id: string }) => void
}

/**
 * RN 端「知识库搜索结果」薄壳 —— 承载 web /knowledge-base/search。
 * 渲染全部委托共享屏,本文件只管:
 *  - 取数 GET /api/knowledge-base?search=&pageSize=50(契约 apps/api/src/routes/other/knowledge-base-routes.ts:33-83,
 *    信封 success({ list, total }) 在 :82;挂载前缀 /api 见 apps/api/src/routes/routes 索引 index.ts:1119);
 *  - 关键词提交(web router.push(?q=) 同语义,RN 落本地 state 后重查,不回写 URL);
 *  - 日期 Intl 格式化(与 web 同参 locale + month:'short' + day:'numeric',PageClient.tsx:75);
 *  - 登录门(web knowledge-base/search 用 useAuthGate + AuthGatePrompt,PageClient.tsx:58,121-122,同口径)。
 * 口径差:web 用 <mark> 高亮命中词,RN 无内联富文本切片,按原文渲染(已在共享屏头注登记)。
 */
export function KnowledgeBaseSearchScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProps>()

  const initialQuery = route.params?.q ?? ''
  const [keyword, setKeyword] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [rows, setRows] = useState<KnowledgeBaseSearchRowView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale],
  )

  const toRow = useCallback(
    (item: KnowledgeBaseListItem): KnowledgeBaseSearchRowView => {
      const d = item.updatedAt ? new Date(item.updatedAt) : null
      return {
        id: item.id,
        title: item.title,
        summary: item.summary ?? null,
        categoryName: item.categoryName ?? null,
        updatedText: d && !Number.isNaN(d.getTime()) ? dateFmt.format(d) : '-',
      }
    },
    [dateFmt],
  )

  const load = useCallback(
    async (target: string) => {
      const kw = target.trim()
      if (!user || !kw) {
        setRows([])
        setTotal(0)
        setError(null)
        return
      }
      setLoading(true)
      try {
        const res = await getKnowledgeBaseList({ search: kw, pageSize: PAGE_SIZE, page: 1 })
        if (!res.success || !res.data) {
          setError(res.error || t('common.loadFailed'))
          setRows([])
          setTotal(0)
          return
        }
        setError(null)
        const list = res.data.list ?? []
        setTotal(res.data.total ?? list.length)
        setRows(list.map(toRow))
      } catch {
        setError(t('common.loadFailed'))
        setRows([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [user, toRow, t],
  )

  useEffect(() => {
    void load(query)
  }, [load, query])

  const submit = useCallback(() => {
    setQuery(keyword.trim())
  }, [keyword])

  return (
    <SharedKnowledgeBaseSearchScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      query={query}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onSubmit={submit}
      loading={loading}
      error={error}
      rows={rows}
      total={total}
      onOpenArticle={(id) =>
        navigation.navigate('KnowledgeBaseArticle', { id })
      }
      onRetry={() => void load(query)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
