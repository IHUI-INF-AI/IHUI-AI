// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getBusinessCardFavorites,
  unfavoriteBusinessCard,
  type BusinessCardFavoriteRow,
} from '@ihui/api-client'
import {
  BusinessCardFavoritesScreen as SharedBusinessCardFavoritesScreen,
  type BusinessCardFavRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 与前端显式分页同值(chat 域先例:上限 100,20 为常用页宽) */
const PAGE_SIZE = 20

const NS = 'businessCardFavPage'

/**
 * RN 端「收藏的名片」薄壳 —— 承载 web /business-card/favorites。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/business-card/favorites(契约 packages/api-client/src/endpoints/
 * business-card-favorites.ts 现读注释;行=扁平行,favoritedAt 为收藏时间,id 为删除参数)、
 * 分页游标(page/pageSize,触底续页)、时间 Intl 格式化(web page.tsx:64 同参
 * {month:'2-digit',day:'2-digit'},无效值 → 空串,web `fmt` 同式)、登录门(未登录不发注定 401 的查询)。
 * 取消收藏:web useMutation.onSuccess 触发 invalidateQueries 重拉 → RN 等价 = 成功后重拉第 1 页;
 * web onError 缺省(失败无提示)→ RN 保持同静默,不擅加提示制造行为差。
 * 口径差:web「查看」跳 /business-card/share/[cardId],RN 未注册该路由,共享屏不渲染该按钮。
 */
export function BusinessCardFavoritesScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [rows, setRows] = useState<BusinessCardFavRowView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' }),
    [locale],
  )

  /** 收藏时间文本:web 同式(month/day 2-digit,无效 → 空串);前缀走键注入 */
  const favoriteText = useCallback(
    (value: string | null | undefined): string => {
      if (!value) return t(`${NS}.favoritedAt`, { date: '' })
      const d = new Date(value)
      const date = Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
      return t(`${NS}.favoritedAt`, { date })
    },
    [dateFmt, t],
  )

  const toRow = useCallback(
    (item: BusinessCardFavoriteRow): BusinessCardFavRowView => ({
      id: item.id,
      name: item.name ?? '',
      titleText: item.title ?? '',
      companyText: item.company ?? '',
      avatarUrl: item.avatar ?? '',
      favoritedText: favoriteText(item.favoritedAt),
      initials: '',
    }),
    [favoriteText],
  )

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getBusinessCardFavorites({ page: nextPage, pageSize: PAGE_SIZE })
        if (!res.success || !res.data) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        setError(null)
        const items = res.data.list ?? []
        setTotal(res.data.total ?? 0)
        const mapped = items.map(toRow)
        setRows((prev) => (append ? [...prev, ...mapped] : mapped))
        setPage(nextPage)
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, toRow, t],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const remove = useCallback(
    async (cardId: string) => {
      setRemovingId(cardId)
      try {
        const res = await unfavoriteBusinessCard(cardId)
        // web onSuccess → invalidateQueries 重拉;失败静默(web 该 mutation 无 onError 提示,不擅加)
        if (res.success) void load(1, false)
      } catch {
        // 同 web:静默失败,列表保持原状
      } finally {
        setRemovingId(null)
      }
    },
    [load],
  )

  const hasMore = rows.length < total

  return (
    <SharedBusinessCardFavoritesScreen
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
      removingId={removingId}
      onRemove={(cardId) => void remove(cardId)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
