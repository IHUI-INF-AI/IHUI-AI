// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getChatFavorites, type FavoriteConversation } from '@ihui/api-client'
import {
  ChatFavoritesScreen as SharedChatFavoritesScreen,
  type FavoriteConversationRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 与后端分页默认同值(pageSize 默认 20,apps/api/src/routes/chat.ts:228) */
const PAGE_SIZE = 20

const NS = 'chatFavoritesPage'

/**
 * RN 端「收藏的任务」薄壳 —— 承载 web /chat/favorites。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/chat/favorites(契约 apps/api/src/routes/chat.ts:1670-1700,需登录)、
 * 分页游标(page/pageSize,触底续页)、时间 Intl 格式化(与 web 同参 locale + 年月日时分)、
 * 置顶优先排序(web sortPinnedFirst 同语义:仅本页内 pinned 稳定前置)、登录门(未登录不发注定 401 的查询)。
 * 口径差:web 上一页/下一页按钮在 RN 改为下拉刷新 + 触底续页(同端点同参数),如实登记不谎称同款。
 */
export function ChatFavoritesScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [rows, setRows] = useState<FavoriteConversationRowView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string | null): string => {
      if (!value) return '-'
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const toRow = useCallback(
    (item: FavoriteConversation): FavoriteConversationRowView => ({
      id: item.id,
      title: item.title,
      model: item.model,
      timeText: fmtDate(item.lastMessageAt),
      pinned: Boolean(item.pinned),
    }),
    [fmtDate],
  )

  /** 与 web sortPinnedFirst 同语义:仅本页内 pinned 稳定前置 */
  const sortPinnedFirst = useCallback(
    (list: FavoriteConversationRowView[]): FavoriteConversationRowView[] =>
      list
        .slice()
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [],
  )

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getChatFavorites({ page: nextPage, pageSize: PAGE_SIZE })
        if (!res.success || !res.data) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        setError(null)
        const items = res.data.favorites ?? []
        setTotal(res.data.total ?? 0)
        const mapped = sortPinnedFirst(items.map(toRow))
        setRows((prev) => (append ? [...prev, ...mapped] : mapped))
        setPage(nextPage)
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, toRow, sortPinnedFirst, t],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const hasMore = rows.length < total

  return (
    <SharedChatFavoritesScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rows}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onEndReached={() => {
        if (!loading && !loadingMore && hasMore) void load(page + 1, true)
      }}
      onRefresh={() => void load(1, false)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
