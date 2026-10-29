// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { PointHistoryScreen as SharedPointHistoryScreen, type PointHistoryItem } from '@ihui/rn-app'
import { usePaginatedList } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/**
 * GET /api/points/transactions 的权威形状(逐处现读 HEAD):
 * - 注册:apps/api/src/routes/gamification.ts:98 `'/points/transactions'`(server.get 换行形态),
 *   前缀链 apps/api/src/routes/index.ts:572 `server.register(gamificationRoutes, { prefix: '/api' })`。
 * - 响应:apps/api/src/routes/gamification.ts:123 `success({ list, total, page, pageSize })` ⇒ data 是包裹对象。
 * - 行字段:apps/api/src/db/gamification-queries.ts:35 `transactionFields`。
 *   amount/balanceAfter 是 integer 列(packages/database/src/schema/gamification.ts:55-56)⇒ JSON 为 number
 *   (不是 numeric 的字符串);createdAt 是 timestamptz ⇒ JSON 为 ISO 字符串。
 * - 同一份数据的既有消费端:apps/web/app/(main)/points/page.tsx:55。
 */
interface PointTransactionRow {
  id: string
  /** 写入侧只有 'earn' | 'spend'(apps/api/src/db/gamification-queries.ts:164) */
  type: string
  /** varchar(32) notNull:机器键(如 'sign_in' / 'admin' / 'redeem') */
  source: string
  /** 恒正整数(扣减走 spendPoints 的 Math.abs),符号由 type 决定 */
  amount: number
  balanceAfter: number
  /** varchar(255) 可空 */
  description: string | null
  createdAt: string
}

interface PointTransactionsResponse {
  list: PointTransactionRow[]
  total: number
  page: number
  pageSize: number
}

/** 后端行 → 本屏 PointHistoryItem(逐字段映射,不把后端行整体当本屏类型用) */
function toPointHistoryItem(
  row: PointTransactionRow,
  formatTime: (iso: string) => string,
): PointHistoryItem {
  return {
    id: row.id,
    // description 可空 ⇒ 回落 notNull 的 source;两端都不读成空串
    action: row.description ?? row.source,
    points: row.type === 'spend' ? -Math.abs(row.amount) : row.amount,
    balance: row.balanceAfter,
    createdAt: formatTime(row.createdAt),
  }
}

export function PointHistoryScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const formatTime = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    return (iso: string): string => {
      const date = new Date(iso)
      return Number.isNaN(date.getTime()) ? iso : formatter.format(date)
    }
  }, [locale])

  // 后端 gamification.ts 回 success({ list, total, page, pageSize }) ⇒ 走 usePaginatedList 的
  // total 支;行映射留在 fetcher 里(不把后端行整体当本屏类型用)。
  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      try {
        const res = await fetchApi<PointTransactionsResponse>(
          `/api/points/transactions?page=${page}&pageSize=${pageSize}`,
        )
        if (!res.success) return { success: false as const, error: t('pointHistory.loadFailed') }
        return {
          success: true as const,
          data: {
            list: (res.data?.list ?? []).map((row) => toPointHistoryItem(row, formatTime)),
            total: res.data?.total ?? 0,
          },
        }
      } catch {
        return { success: false as const, error: t('pointHistory.loadFailed') }
      }
    },
    [t, formatTime],
  )
  const { items, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePaginatedList<PointHistoryItem>(fetcher, PAGE_SIZE)

  return (
    <SharedPointHistoryScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      onEndReached={loadMore}
      loadingMore={loadingMore}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
