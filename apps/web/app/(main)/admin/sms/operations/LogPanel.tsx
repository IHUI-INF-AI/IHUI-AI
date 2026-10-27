// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
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
  LOG_STATUS,
  api,
  categoryLabel,
  fmtTime,
  logStatus,
  providerLabel,
  templateLabel,
} from './helpers'
import type { SmsDeliveryLog, SmsLogsResponse } from './types'

const PAGE_SIZE = 20
const EXPORT_LIMIT = 200

const EXPORT_COLS: ExportColumn[] = [
  { key: 'created_at', title: '发送时间', formatter: (v) => fmtTime(v) },
  { key: 'provider', title: '通道' },
  { key: 'category', title: '类别' },
  { key: 'template_key', title: '模板' },
  { key: 'template_id', title: '模板 ID' },
  { key: 'phone', title: '手机号' },
  { key: 'status', title: '状态' },
  { key: 'reason', title: '原因' },
  { key: 'request_id', title: 'RequestId' },
  { key: 'serial_no', title: 'SerialNo' },
  { key: 'biz_type', title: '业务类型' },
  { key: 'biz_id', title: '业务 ID' },
]

function buildQuery(status: string, limit: number, offset: number): string {
  const p = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status !== 'all') p.set('status', status)
  return p.toString()
}

export function LogPanel() {
  const [status, setStatus] = React.useState('all')
  const [offset, setOffset] = React.useState(0)
  const [exporting, setExporting] = React.useState(false)

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
      exportToExcel('短信发送台账', EXPORT_COLS, all.items as unknown as Record<string, unknown>[])
      toast.success(`已导出 ${all.items.length} 条`)
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
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(LOG_STATUS).map(([key, v]) => (
                <SelectItem key={key} value={key}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
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
            导出
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            最多导出最近 {EXPORT_LIMIT} 条
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>共 {isError ? '—' : total} 条</span>
          {Object.keys(LOG_STATUS)
            .filter((k) => (counts[k] ?? 0) > 0)
            .map((k) => {
              const meta = LOG_STATUS[k]
              if (!meta) return null
              return (
                <Badge key={k} variant={meta.tone}>
                  {meta.label} {counts[k]}
                </Badge>
              )
            })}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">通道</th>
                <th className="px-3 py-2 font-medium">类别</th>
                <th className="px-3 py-2 font-medium">模板</th>
                <th className="px-3 py-2 font-medium">号码</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">原因</th>
                <th className="px-3 py-2 font-medium">RequestId</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    加载中…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center">
                    <p className="text-destructive">
                      台账加载失败,下方不是「没有记录」而是没取到。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => void refetch()}
                    >
                      <RefreshCw className="h-4 w-4" />
                      重试
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    暂无发送记录
                  </td>
                </tr>
              ) : (
                items.map((row: SmsDeliveryLog) => {
                  const s = logStatus(row.status)
                  return (
                    <tr key={row.id} className="border-t hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2">{fmtTime(row.created_at)}</td>
                      <td className="px-3 py-2">{providerLabel(row.provider)}</td>
                      <td className="px-3 py-2">{categoryLabel(row.category)}</td>
                      <td className="px-3 py-2">
                        {row.template_key ? templateLabel(row.template_key) : '-'}
                      </td>
                      <td className="px-3 py-2 font-mono">{row.phone}</td>
                      <td className="px-3 py-2">
                        <Badge variant={s.tone}>{s.label}</Badge>
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
            第 {page} 页 · 每页 {PAGE_SIZE} 条 · 共 {total} 条
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasNext}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              下一页
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
