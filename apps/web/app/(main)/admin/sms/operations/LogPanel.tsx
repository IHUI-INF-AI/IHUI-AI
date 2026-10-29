// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { exportToExcel, type ExportColumn } from '@/lib/export-utils'
import {
  BASE,
  CATEGORY_LABEL_KEYS,
  LOG_STATUS,
  PROVIDER_LABEL_KEYS,
  TEMPLATE_LABEL_KEYS,
  api,
  codeLabel,
  fmtTime,
  logStatus,
} from './helpers'
import type { SmsDeliveryLog, SmsLogsResponse } from './types'

const PAGE_SIZE = 20
const EXPORT_LIMIT = 200

/** 导出列的表头是给用户看的文案,故按 i18n 键存;实际取词在组件内做。
 *  RequestId / SerialNo 是云侧字段本名,不属于待译文案,保留 `title` 直填。 */
const EXPORT_COLS: {
  key: string
  labelKey?: string
  title?: string
  withTime?: boolean
}[] = [
  { key: 'created_at', labelKey: 'log.colSendTime', withTime: true },
  { key: 'provider', labelKey: 'field.channel' },
  { key: 'category', labelKey: 'field.category' },
  { key: 'template_key', labelKey: 'field.template' },
  { key: 'template_id', labelKey: 'field.templateId' },
  { key: 'phone', labelKey: 'field.phone' },
  { key: 'status', labelKey: 'field.status' },
  { key: 'reason', labelKey: 'field.reason' },
  { key: 'request_id', title: 'RequestId' },
  { key: 'serial_no', title: 'SerialNo' },
  { key: 'biz_type', labelKey: 'field.bizType' },
  { key: 'biz_id', labelKey: 'field.bizId' },
]

function buildQuery(status: string, limit: number, offset: number): string {
  const p = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status !== 'all') p.set('status', status)
  return p.toString()
}

export function LogPanel() {
  const t = useTranslations('admin.smsOperations')
  const tc = useTranslations('common')
  const [status, setStatus] = React.useState('all')
  const [offset, setOffset] = React.useState(0)
  const [exporting, setExporting] = React.useState(false)

  const exportCols: ExportColumn[] = EXPORT_COLS.map(({ key, labelKey, title, withTime }) => ({
    key,
    title: labelKey ? t(labelKey) : (title ?? key),
    ...(withTime ? { formatter: (v: unknown) => fmtTime(v) } : {}),
  }))

  const params = buildQuery(status, PAGE_SIZE, offset)
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'sms-operations', 'logs', params],
    queryFn: () => api<SmsLogsResponse>(`${BASE}/logs?${params}`),
  })
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const counts = data?.counts ?? {}
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const hasNext = offset + items.length < total

  async function handleExport() {
    setExporting(true)
    try {
      const all = await api<SmsLogsResponse>(`${BASE}/logs?${buildQuery(status, EXPORT_LIMIT, 0)}`)
      exportToExcel(
        t('log.exportFileName'),
        exportCols,
        all.items as unknown as Record<string, unknown>[],
      )
      toast.success(t('log.exported', { count: all.items.length }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('log.allStatuses')}</SelectItem>
              {Object.entries(LOG_STATUS).map(([key, v]) => (
                <SelectItem key={key} value={key}>
                  {t(v.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {tc('refresh')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {tc('export')}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {t('log.exportLimitHint', { limit: EXPORT_LIMIT })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t('log.totalCount', { count: isError ? '—' : total })}</span>
          {Object.keys(LOG_STATUS)
            .filter((k) => (counts[k] ?? 0) > 0)
            .map((k) => {
              const meta = LOG_STATUS[k]
              if (!meta) return null
              return (
                <Badge key={k} variant={meta.tone}>
                  {t(meta.key)} {counts[k]}
                </Badge>
              )
            })}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('field.time')}</th>
                <th className="px-3 py-2 font-medium">{t('field.channel')}</th>
                <th className="px-3 py-2 font-medium">{t('field.category')}</th>
                <th className="px-3 py-2 font-medium">{t('field.template')}</th>
                <th className="px-3 py-2 font-medium">{t('field.number')}</th>
                <th className="px-3 py-2 font-medium">{t('field.status')}</th>
                <th className="px-3 py-2 font-medium">{t('field.reason')}</th>
                <th className="px-3 py-2 font-medium">RequestId</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    {t('pager.loading')}
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center">
                    <p className="text-destructive">{t('log.loadFailed')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => void refetch()}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {tc('retry')}
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    {t('log.empty')}
                  </td>
                </tr>
              ) : (
                items.map((row: SmsDeliveryLog) => {
                  const s = logStatus(row.status)
                  return (
                    <tr key={row.id} className="border-t hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2">{fmtTime(row.created_at)}</td>
                      <td className="px-3 py-2">
                        {codeLabel(PROVIDER_LABEL_KEYS, row.provider, t)}
                      </td>
                      <td className="px-3 py-2">
                        {codeLabel(CATEGORY_LABEL_KEYS, row.category, t)}
                      </td>
                      <td className="px-3 py-2">
                        {codeLabel(TEMPLATE_LABEL_KEYS, row.template_key, t)}
                      </td>
                      <td className="px-3 py-2 font-mono">{row.phone}</td>
                      <td className="px-3 py-2">
                        <Badge variant={s.tone}>{t(s.key, s.values)}</Badge>
                      </td>
                      <td className="max-w-56 truncate px-3 py-2" title={row.reason ?? ''}>
                        {row.reason ?? '-'}
                      </td>
                      <td
                        className="max-w-40 truncate px-3 py-2 font-mono text-xs"
                        title={row.request_id ?? ''}
                      >
                        {row.request_id ?? '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {t('log.pagination', { page, size: PAGE_SIZE, total })}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t('pager.prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasNext}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t('pager.next')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
