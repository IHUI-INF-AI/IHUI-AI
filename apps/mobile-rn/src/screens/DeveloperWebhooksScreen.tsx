// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Webhooks 管理页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏
 * `packages/app/src/features/console-table/ConsoleTableScreen.tsx`。
 * 端点走 @ihui/api-client 现成封装(getWebhooks/deleteWebhook,§3 共享层优先):
 *  - GET    /api/developer/webhooks ⇒ PageData<Webhook>
 *  - DELETE /api/developer/webhooks/:id(行点按 → 确认删除)
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { getWebhooks, deleteWebhook, type Webhook } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

const PAGE_SIZE = 20

export function DeveloperWebhooksScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = useCallback(
    (iso: string | null | undefined) => {
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

  const toRows = useCallback(
    (list: Webhook[]): ConsoleRowView[] =>
      list.map((w) => ({
        id: w.id,
        cells: {
          url: w.url,
          events: w.events.join(', '),
          status:
            w.status === 'disabled'
              ? t('developerWebhooks.disabled')
              : t('developerWebhooks.active'),
          last: w.lastTriggeredAt
            ? `${fmtDate(w.lastTriggeredAt)}${w.lastResponseStatus !== null && w.lastResponseStatus !== undefined ? ` · ${String(w.lastResponseStatus)}` : ''}`
            : t('developerWebhooks.never'),
        },
        badgeTone: w.status === 'disabled' ? 'muted' : 'ok',
      })),
    [t, fmtDate],
  )

  const load = useCallback(
    async (page: number, append: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getWebhooks({ page, pageSize: PAGE_SIZE })
        if (!res.success) throw new Error(res.error || 'load failed')
        const list = res.data?.list ?? []
        setRows((prev) => (append ? [...prev, ...toRows(list)] : toRows(list)))
        setTotal(res.data?.total ?? list.length)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'load failed')
      } finally {
        setLoading(false)
      }
    },
    [toRows],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const onRowPress = useCallback(
    (row: ConsoleRowView) => {
      void appAlert(
        t('developerWebhooks.deleteConfirmTitle'),
        `${t('developerWebhooks.deleteConfirmDesc')} ${row.cells.url ?? ''}`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('developerWebhooks.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await deleteWebhook(row.id)
                if (!res.success) throw new Error(res.error)
                void load(1, false)
              } catch (e) {
                void appAlert(
                  t('common.error'),
                  e instanceof Error ? e.message : t('developerWebhooks.delete'),
                )
              }
            },
          },
        ],
      )
    },
    [load, t],
  )

  const columns: ConsoleColumn[] = [
    { key: 'url', title: t('developerWebhooks.url'), render: 'mono', flex: 2 },
    { key: 'status', title: t('developerWebhooks.status'), render: 'badge' },
    { key: 'events', title: t('developerWebhooks.events'), flex: 2 },
    { key: 'last', title: t('developerWebhooks.lastTriggered') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('developerWebhooks.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      hasMore={rows.length < total}
      onRetry={() => void load(1, false)}
      onRefresh={() => void load(1, false)}
      onLoadMore={() => void load(Math.ceil(rows.length / PAGE_SIZE) + 1, true)}
      onRowPress={onRowPress}
    />
  )
}

export default DeveloperWebhooksScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
