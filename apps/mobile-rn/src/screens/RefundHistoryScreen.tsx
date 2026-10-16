// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  RefundHistoryScreen as SharedRefundHistoryScreen,
  type RefundHistoryItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * GET /api/refunds/me 的行 —— 后端权威形状逐字段现读自
 * `packages/database/src/schema/order.ts` 的 `eduRefunds`(`EduRefund = $inferSelect`):
 * refundAmount 是 `numeric(10,2)` ⇒ drizzle 回**字符串**,reason 可空,createdAt 是 timestamp。
 * handler 在 `apps/api/src/routes/order.ts`(`server.get('/refunds/me')` →
 * `success(await findRefunds(...))`,`findRefunds` 在 `apps/api/src/db/order-queries.ts` 回
 * `{ list, total, page, pageSize }`),经 `routes/index.ts` 的
 * `register(orderRoutes, { prefix: '/api' })` 挂上 ⇒ 真端点 = `/api/refunds/me`。
 * web 消费端 `apps/web/app/(main)/refund/page.tsx` 同样只取 `{ list }` 且不传分页(吃后端默认档)。
 *
 * 旧的 `'/refund'` 是死路径:`'/refund'` 字面注册只住在
 * `apps/api/src/routes/edu-ai-management.ts`(该文件前缀 `/api/edu-ai-management`),
 * 而 `fetchApi` 的 normalizeUrl 会把 `/refund` 补成 `/api/refund` ⇒ 404,本屏永远空列表。
 */
interface RefundRow {
  id: string
  refundAmount: string
  status: string
  reason: string | null
  createdAt: string
}

function formatDate(iso: string, fmt: Intl.DateTimeFormat): string {
  if (!iso) return ''
  const d = new Date(iso)
  // 解析不了就交原文,不编一个日期
  return Number.isNaN(d.getTime()) ? iso : fmt.format(d)
}

/** 后端真名 → 共享屏 RefundHistoryItem(amount 取数、reason 兜空串) */
function toRefundHistoryItem(row: RefundRow, fmt: Intl.DateTimeFormat): RefundHistoryItem {
  const amount = Number(row.refundAmount)
  return {
    id: row.id,
    amount: Number.isFinite(amount) ? amount : 0,
    status: row.status,
    reason: row.reason ?? '',
    createdAt: formatDate(row.createdAt, fmt),
  }
}

export function RefundHistoryScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<RefundHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 与 web 同档(年/月/日 + 时:分),共享屏直接渲染字符串 ⇒ 包装层负责取数后的呈现
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

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<{ list: RefundRow[]; total: number }>('/api/refunds/me')
      if (!res.success) throw new Error(res.error)
      setItems((res.data?.list ?? []).map((row) => toRefundHistoryItem(row, dateFmt)))
    } catch {
      setError(t('refundHistory.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t, dateFmt])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedRefundHistoryScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={(item) => navigation.navigate('RefundDetail', { id: item.id })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
