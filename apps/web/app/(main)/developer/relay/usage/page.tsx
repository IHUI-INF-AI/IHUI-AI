'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Activity, Download, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface UsageRow {
  groupKey: string
  callCount: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  successCount: number
  errorCount: number
  totalCostCents: number
  byokCallCount: number
  relayCallCount: number
  upstreamCostCents: number
  platformFeeCents: number
}

interface UsageData {
  groupBy: 'model' | 'day'
  mode: 'all' | 'relay' | 'byok'
  rows: UsageRow[]
  summary: {
    totalCalls: number
    totalTokens: number
    totalCostCents: number
    byokCallCount: number
    relayCallCount: number
    upstreamCostCents: number
    platformFeeCents: number
  }
}

type ModeFilter = 'all' | 'relay' | 'byok'

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function exportCsv(rows: UsageRow[], groupBy: 'model' | 'day') {
  const head = [
    groupBy === 'day' ? '日期' : '模型',
    '调用次数',
    '总Token',
    'PromptToken',
    'CompletionToken',
    '成功',
    '失败',
    '消耗(元)',
    'BYOK调用',
    '中转站调用',
    '上游成本(元)',
    '平台服务费(元)',
  ]
  const lines = rows.map((r) =>
    [
      r.groupKey,
      r.callCount,
      r.totalTokens,
      r.promptTokens,
      r.completionTokens,
      r.successCount,
      r.errorCount,
      (r.totalCostCents / 100).toFixed(2),
      r.byokCallCount,
      r.relayCallCount,
      r.byokCallCount > 0 ? (r.upstreamCostCents / 100).toFixed(4) : '',
      r.byokCallCount > 0 ? (r.platformFeeCents / 100).toFixed(4) : '',
    ].join(','),
  )
  const csv = '\uFEFF' + [head.join(','), ...lines].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `relay-usage-${groupBy}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('已导出 CSV')
}

/** 调用模式徽章:仅 BYOK=绿 / 仅中转站=灰 / 混合=蓝 */
function ModeBadge({ byok, relay }: { byok: number; relay: number }) {
  if (byok > 0 && relay > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        混合
      </span>
    )
  }
  if (byok > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        BYOK
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      中转站
    </span>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export default function RelayUsagePage() {
  const locale = useLocale()
  const [groupBy, setGroupBy] = React.useState<'model' | 'day'>('model')
  const [mode, setMode] = React.useState<ModeFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const num = new Intl.NumberFormat(locale)

  const qs = new URLSearchParams({ groupBy, mode })
  if (startDate) qs.set('startDate', startDate)

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'relay', 'usage', groupBy, mode, startDate],
    queryFn: () => api<UsageData>(`/api/developer/relay/usage?${qs.toString()}`),
  })

  const rows = data?.rows ?? []
  const summary = data?.summary

  return (
    <div className="space-y-4">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" />
            用量明细
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按模型或按日查看中转站 / BYOK 调用统计
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportCsv(rows, groupBy)}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" />
          导出 CSV
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as ModeFilter)}>
          <SelectTrigger className="w-32" aria-label="调用模式">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="relay">中转站</SelectItem>
            <SelectItem value="byok">BYOK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'model' | 'day')}>
          <SelectTrigger className="w-32" aria-label="分组">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="model">按模型</SelectItem>
            <SelectItem value="day">按日</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
          aria-label="起始日期"
        />
        {startDate && (
          <Button size="sm" variant="ghost" onClick={() => setStartDate('')}>
            清除
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 min-[768px]:grid-cols-3 min-[1024px]:grid-cols-6">
        <SummaryCard label="总调用" value={summary ? num.format(summary.totalCalls) : '—'} />
        <SummaryCard label="总 Token" value={summary ? num.format(summary.totalTokens) : '—'} />
        <SummaryCard
          label="总消耗"
          value={summary ? (summary.totalCostCents / 100).toFixed(2) + ' 元' : '—'}
        />
        <SummaryCard
          label="BYOK 调用"
          value={summary ? num.format(summary.byokCallCount) : '—'}
        />
        <SummaryCard
          label="BYOK 上游成本"
          value={summary ? (summary.upstreamCostCents / 100).toFixed(4) + ' 元' : '—'}
        />
        <SummaryCard
          label="BYOK 平台服务费"
          value={summary ? (summary.platformFeeCents / 100).toFixed(4) + ' 元' : '—'}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{groupBy === 'day' ? '日期' : '模型'}</th>
              <th className="px-3 py-2 text-right">调用</th>
              <th className="px-3 py-2 text-right">总 Token</th>
              <th className="px-3 py-2 text-right">Prompt</th>
              <th className="px-3 py-2 text-right">Completion</th>
              <th className="px-3 py-2 text-right">成功</th>
              <th className="px-3 py-2 text-right">失败</th>
              <th className="px-3 py-2 text-left">调用模式</th>
              <th className="px-3 py-2 text-right">消耗(元)</th>
              <th className="px-3 py-2 text-right">上游成本(元)</th>
              <th className="px-3 py-2 text-right">平台服务费(元)</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.groupKey} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.groupKey}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num.format(r.callCount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num.format(r.totalTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num.format(r.promptTokens)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num.format(r.completionTokens)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {r.successCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                    {r.errorCount}
                  </td>
                  <td className="px-3 py-2">
                    <ModeBadge byok={r.byokCallCount} relay={r.relayCallCount} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(r.totalCostCents / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.byokCallCount > 0 ? (r.upstreamCostCents / 100).toFixed(4) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.byokCallCount > 0 ? (r.platformFeeCents / 100).toFixed(4) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
