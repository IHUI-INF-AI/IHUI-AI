// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转会话记录页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen。
 * 端点:GET /api/developer/conversations?page&pageSize ⇒ { items: Conversation[], total, page, pageSize }
 * (与 web developer/conversations 同源;金额分→元经共享 formatPrice 换算,端内不自算)。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { formatPrice } from '@ihui/shared/utils'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

const PAGE_SIZE = 20

interface Conversation {
  id: string
  conversationId: string
  title: string | null
  model: string | null
  messageCount: number
  totalTokens: number
  totalCostCents: number
  lastMessageAt: string
  createdAt: string
}

function DeveloperConversationsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const load = useCallback(
    async (page: number, append: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchApi<{ items: Conversation[]; total: number }>(
          `/api/developer/conversations?page=${page}&pageSize=${PAGE_SIZE}`,
        )
        if (!res.success) throw new Error(res.error || 'load failed')
        const list = res.data?.items ?? []
        const next = list.map((c) => ({
          id: c.id,
          cells: {
            title: c.title ?? c.conversationId,
            model: c.model ?? '—',
            messages: String(c.messageCount),
            tokens:
              c.totalTokens > 1000
                ? `${(c.totalTokens / 1000).toFixed(1)}k`
                : String(c.totalTokens),
            cost: formatPrice(c.totalCostCents),
            last: fmtDate(c.lastMessageAt),
          },
        }))
        setRows((prev) => (append ? [...prev, ...next] : next))
        setTotal(res.data?.total ?? list.length)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'load failed')
      } finally {
        setLoading(false)
      }
    },
    [fmtDate],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const columns: ConsoleColumn[] = [
    { key: 'title', title: t('developerConversations.title2'), flex: 2 },
    { key: 'model', title: t('developerConversations.model') },
    { key: 'messages', title: t('developerConversations.messages') },
    { key: 'tokens', title: t('developerConversations.tokens') },
    { key: 'cost', title: t('developerConversations.cost'), render: 'badge' },
    { key: 'last', title: t('developerConversations.lastActive') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('developerConversations.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      hasMore={rows.length < total}
      onRetry={() => void load(1, false)}
      onRefresh={() => void load(1, false)}
      onLoadMore={() => void load(Math.ceil(rows.length / PAGE_SIZE) + 1, true)}
    />
  )
}

export default DeveloperConversationsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
