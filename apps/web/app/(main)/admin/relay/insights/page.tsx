// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// __PROVENANCE_HEAD_1__
// __PROVENANCE_HEAD_2__
// __PROVENANCE_HEAD_3__

'use client'

/**
 * 运营洞察页(2026-09-17 立,补强 62,差异化:竞品无 AI/自动化运营分析)。
 * 基于库内实测数据自动产出诊断与建议:错误突增/成本异常/容量预警/慢调用/免费敞口。
 * 规则驱动(数字全部来自 SQL 实测聚合),不做 LLM 臆断。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BrainCircuit, Loader2, RefreshCw } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

type Severity = 'critical' | 'warning' | 'info'

interface Insight {
  type: string
  severity: Severity
  title: string
  detail: string
  suggestion: string
}

interface InsightsResult {
  generatedAt: string
  insights: Insight[]
  summary: { critical: number; warning: number; info: number }
}

const SEV_STYLE: Record<Severity, { badge: string; border: string; label: string }> = {
  critical: {
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
    label: '严重',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    label: '警告',
  },
  info: {
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    border: 'border-sky-500/25',
    label: '提示',
  },
}

export default function InsightsPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'relay', 'insights'],
    queryFn: async () => {
      const r = await fetchApi<InsightsResult>('/api/admin/relay/insights')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    // 实时化(2026-09-17,补强 58):每 60s 自动重新分析并刷新界面,
    // 替代手动刷新;后端另有 /relay/insights/stream SSE 端点可供 WS/SSE 客户端订阅。
    refetchInterval: 60_000,
  })

  const insights = data?.insights ?? []
  const summary = data?.summary

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BrainCircuit className="h-5 w-5" aria-hidden />
            运营洞察
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            基于实测数据自动诊断:错误突增、成本异常、容量预警、慢调用与免费敞口。
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
          <span>重新分析</span>
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {(['critical', 'warning', 'info'] as const).map((s) => (
            <div key={s} className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-medium tabular-nums">{summary[s]}</p>
              <p className={cn('mt-1 rounded-md px-2 py-0.5 text-xs', SEV_STYLE[s].badge)}>
                {SEV_STYLE[s].label}
              </p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          分析中...
        </div>
      ) : insights.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          一切正常:未检测到错误突增、成本异常或容量风险。
        </p>
      ) : (
        <div className="space-y-3">
          {insights.map((i, idx) => (
            <Card key={idx} className={cn('border', SEV_STYLE[i.severity].border)}>
              <CardContent className="min-[640px]:p-3 space-y-1.5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-medium',
                      SEV_STYLE[i.severity].badge,
                    )}
                  >
                    {SEV_STYLE[i.severity].label}
                  </span>
                  <p className="text-sm font-medium">{i.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{i.detail}</p>
                <p className="text-xs">
                  <span className="font-medium">建议:</span>
                  <span className="text-muted-foreground">{i.suggestion}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
// __PROVENANCE_TAIL__
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
