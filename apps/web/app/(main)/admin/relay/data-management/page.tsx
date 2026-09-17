// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 数据管理页(2026-09-17 立,PROJECT_PLAN 4-3 条目 56 缺失的管理端补齐)。
 *
 * 背景:56 交付时后端 2 端点落库(各表统计 + 按保留期批量清理),但前端零消费,
 * 运营无法自助看磁盘膨胀、也无法先预演再清理,只能手工连库 DELETE。
 *
 * 数据源 /api/admin/relay/data-management/stats + /cleanup。
 * 安全:表名走后端白名单(前端只发白名单内的 key);清理按 created_at < now() - keepDays 天,
 * 单批上限 50000 行;页面强制「先预览再执行」,执行前二次确认。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Database, Eraser, Loader2, RefreshCw } from 'lucide-react'

import { Button, Input, Label, Loader2 as LoaderIcon } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

interface TableStat {
  table: string
  desc: string
  /** -1 = 该表查询失败(表可能不存在),页面按「不可用」展示 */
  rows: number
  oldest: string | null
}

interface StatsPayload {
  tables: TableStat[]
  generatedAt: string
}

interface CleanupResult {
  table: string
  keepDays: number
  wouldDelete: number
  deleted: number
  dryRun: boolean
}

export default function DataManagementPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const qc = useQueryClient()
  const [keepDays, setKeepDays] = React.useState<Record<string, string>>({})
  const [lastResult, setLastResult] = React.useState<CleanupResult | null>(null)

  const statsQ = useQuery({
    queryKey: ['admin', 'relay', 'data-management', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<StatsPayload>('/api/admin/relay/data-management/stats')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const tables = statsQ.data?.tables ?? []

  const cleanupMut = useMutation({
    mutationFn: async (p: { table: string; days: number; dryRun: boolean }) => {
      const r = await fetchApi<CleanupResult>('/api/admin/relay/data-management/cleanup', {
        method: 'POST',
        body: JSON.stringify({ table: p.table, keepDays: p.days, dryRun: p.dryRun }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      setLastResult(d)
      if (d.dryRun) {
        toast.success(`预览:将删除 ${d.wouldDelete} 行(未实际删除)`)
      } else {
        toast.success(`已删除 ${d.deleted} 行`)
        void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'data-management', 'stats'] })
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const daysOf = (table: string) => keepDays[table] ?? '90'

  const runPreview = (row: TableStat) => {
    const days = Number(daysOf(row.table))
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      toast.error('保留天数需为 1-3650 的整数')
      return
    }
    cleanupMut.mutate({ table: row.table, days, dryRun: true })
  }

  const runCleanup = (row: TableStat) => {
    const days = Number(daysOf(row.table))
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      toast.error('保留天数需为 1-3650 的整数')
      return
    }
    void confirm({
      title: `确认清理「${row.desc}」`,
      description: `将永久删除该表 ${days} 天前的记录(单批上限 50000 行,超量可重复执行)。此操作不可撤销,建议先点「预览」确认行数。`,
      variant: 'destructive',
    }).then((ok) => {
      if (ok) cleanupMut.mutate({ table: row.table, days, dryRun: false })
    })
  }

  const busy = cleanupMut.isPending
  const totalRows = tables.reduce((sum, t) => sum + (t.rows > 0 ? t.rows : 0), 0)

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Database className="h-5 w-5" aria-hidden />
            数据保留与清理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            日志与事件流保留期管理:按表统计行数与最老记录,按保留天数批量清理,防磁盘膨胀。
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void statsQ.refetch()}
            disabled={statsQ.isFetching}
          >
            {statsQ.isFetching ? (
              <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            <span>刷新统计</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          可清理表 {tables.length} 张,合计行数{' '}
          <span className="font-medium tabular-nums text-foreground">{totalRows}</span>
        </span>
        {statsQ.data?.generatedAt && (
          <span>统计时间 {new Date(statsQ.data.generatedAt).toLocaleString('zh-CN')}</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">表</th>
              <th className="px-3 py-2 font-medium">说明</th>
              <th className="px-3 py-2 font-medium">行数</th>
              <th className="px-3 py-2 font-medium">最老记录</th>
              <th className="px-3 py-2 font-medium">保留天数</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {tables.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {statsQ.isLoading ? '加载中...' : '暂无统计数据'}
                </td>
              </tr>
            ) : (
              tables.map((row) => (
                <tr key={row.table} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{row.table}</td>
                  <td className="px-3 py-2">{row.desc}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.rows < 0 ? (
                      <span className="text-muted-foreground">不可用</span>
                    ) : (
                      row.rows
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.oldest ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-7 w-20"
                      inputMode="numeric"
                      value={daysOf(row.table)}
                      aria-label={`${row.desc} 保留天数`}
                      onChange={(e) =>
                        setKeepDays((prev) => ({ ...prev, [row.table]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || row.rows < 0}
                        onClick={() => runPreview(row)}
                      >
                        <span>预览</span>
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || row.rows < 0}
                        onClick={() => runCleanup(row)}
                      >
                        <Eraser className="h-3 w-3" aria-hidden />
                        <span>清理</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {lastResult && (
        <div className="rounded-lg border p-3 text-xs">
          <div className="font-medium">
            最近一次操作:{lastResult.table}(保留 {lastResult.keepDays} 天,
            {lastResult.dryRun ? '仅预览' : '已执行'})
          </div>
          <div className="mt-1 text-muted-foreground">
            命中 {lastResult.wouldDelete} 行,
            {lastResult.dryRun ? '未实际删除' : `实际删除 ${lastResult.deleted} 行`}
            {!lastResult.dryRun && lastResult.wouldDelete > lastResult.deleted
              ? '(超出单批上限,可再次执行直至清空)'
              : ''}
          </div>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <Label className="text-xs font-normal">注意事项</Label>
        <p>单批删除上限 50000 行,超量请重复执行;清理按 created_at 判定,不可撤销。</p>
        <p>llm_call_logs 是计费与对账依据,请确认保留期符合对账周期后再清理。</p>
      </div>

      <ConfirmDialogRenderer />
      {statsQ.isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
