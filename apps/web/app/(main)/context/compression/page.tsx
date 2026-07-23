'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Loader2, RotateCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchCompressionStats } from '@/lib/context-api'
import { CompressionStatsTable } from '@/components/context/CompressionStatsTable'

export default function ContextCompressionPage() {
  const statsQ = useQuery({
    queryKey: ['context', 'compression-stats'],
    queryFn: () => fetchCompressionStats(),
  })

  const stats = statsQ.data

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/context"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            返回上下文总览
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">压缩统计</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            查看平均压缩比、平均质量分与最近 10 次压缩详情
          </p>
        </div>
        <button
          type="button"
          onClick={() => void statsQ.refetch()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCw className="h-3 w-3" />
          刷新
        </button>
      </div>

      {statsQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : statsQ.error ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>加载失败:{(statsQ.error as Error).message}</span>
        </div>
      ) : !stats ? (
        <div className="py-12 text-center text-sm text-muted-foreground">暂无数据</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="总压缩次数"
              value={stats.totalCompressions.toLocaleString()}
              tone="default"
            />
            <StatCard
              label="平均压缩比"
              value={`${(stats.avgCompressionRatio * 100).toFixed(1)}%`}
              tone="emerald"
            />
            <StatCard
              label="平均质量分"
              value={`${(stats.avgQualityScore * 100).toFixed(0)}%`}
              tone="amber"
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">最近 {stats.recent.length} 次压缩</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <CompressionStatsTable stats={stats} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'default' | 'emerald' | 'amber'
}) {
  const toneCls =
    tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'amber'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground'
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneCls}`}>{value}</p>
    </div>
  )
}
