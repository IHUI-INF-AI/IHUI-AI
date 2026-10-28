// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { AskListScreen as SharedAskListScreen, type AskListItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * GET /api/asks 列表行 —— 后端权威形状逐字段现读自
 * `apps/api/src/db/community-queries.ts` 的 `findAsks()` cols(id/title/answerCount/viewCount/
 * createdAt/authorName 六列本屏用到);handler 在 `apps/api/src/routes/community/asks.ts`
 * (`server.get('/asks')` → `success({ list, total, page, pageSize })`),经
 * `routes/community.ts` 的 `register(asksRoutes)`(不加前缀)+ `routes/index.ts` 的
 * `register(communityRoutes, { prefix: '/api' })` 挂上 ⇒ 真端点 = `/api/asks`。
 * 消费侧同形态读法见 web `apps/web/app/(main)/asks/types.ts` 的 `AsksData`。
 */
interface AskRow {
  id: string
  title: string
  answerCount: number
  viewCount: number
  createdAt: string
  authorName: string | null
}

/** 后端 success() 信封里 data 的真形状(整包不是数组) */
interface AsksPage {
  list: AskRow[]
  total: number
  page: number
  pageSize: number
}

/** 后端 `listAsksQuery` 默认档 page=1/pageSize=20,与 web `PAGE_SIZE` 同值 */
const ASKS_PAGE_SIZE = 20

/** 后端真名 → 共享屏 AskListItem(字段名两侧不同形,必须显式映射) */
function toAskListItem(row: AskRow): AskListItem {
  return {
    id: row.id,
    title: row.title,
    // 后端 authorName = users.nickname,leftJoin 可为 null ⇒ 空串,不编造昵称
    author: row.authorName ?? '',
    answerCount: row.answerCount,
    views: row.viewCount,
    createdAt: row.createdAt,
  }
}

export function AskListScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [asks, setAsks] = useState<AskListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingMoreRef = useRef(false)

  /**
   * 取第 next 页。page=1 替换、>1 追加 —— 小程序端此前用 useReachBottom 自己翻页,
   * 而这一屏的 RN 侧只取第一页(后端信封带 total ⇒ 能算还有没有下一页)。
   */
  const fetchPage = async (next: number) => {
    const res = await fetchApi<AsksPage>('/api/asks', {
      params: { page: next, pageSize: ASKS_PAGE_SIZE },
    })
    if (res.success) {
      const rows = (res.data?.list ?? []).map(toAskListItem)
      setAsks((prev) => (next === 1 ? rows : [...prev, ...rows]))
      setHasMore(next * ASKS_PAGE_SIZE < (res.data?.total ?? 0))
      setPage(next)
    } else if (next === 1) {
      setError(apiFailureToText(res, t('askList.loadFailed')))
    }
    return res
  }

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    await fetchPage(1)
    setLoading(false)
    setRefreshing(false)
  }

  const loadMore = async () => {
    if (loading || refreshing || loadingMoreRef.current || !hasMore) return
    loadingMoreRef.current = true
    await fetchPage(page + 1)
    loadingMoreRef.current = false
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SharedAskListScreen
      t={t}
      items={asks}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(true)}
      onLoadMore={() => void loadMore()}
      onPressItem={(id) => navigation.navigate('AskDetail', { id })}
      onCreate={() => navigation.navigate('AskCreate')}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
