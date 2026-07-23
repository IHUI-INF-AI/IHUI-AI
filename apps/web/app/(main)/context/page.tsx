'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, Loader2, RotateCw } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchSources, fetchVisualization } from '@/lib/context-api'
import { SourceList } from '@/components/context/SourceList'
import { TokenPieChart } from '@/components/context/TokenPieChart'
import type { ContextSource, ContextType } from '@ihui/shared/context/index'

const SUB_PAGES = [
  { href: '/context/mentions', title: '@ 提及检索', desc: '检索文件 / 符号 / 数据库 / 网页' },
  { href: '/context/visualization', title: 'Token 可视化', desc: '查看分布饼图与历史趋势' },
  { href: '/context/compression', title: '压缩统计', desc: '查看最近 10 次压缩详情' },
] as const

export default function ContextOverviewPage() {
  const sourcesQ = useQuery({
    queryKey: ['context', 'sources'],
    queryFn: fetchSources,
  })
  const vizQ = useQuery({
    queryKey: ['context', 'visualization', 'overview'],
    queryFn: () => fetchVisualization().catch(() => null),
  })

  const [sources, setSources] = React.useState<ContextSource[]>([])
  React.useEffect(() => {
    if (sourcesQ.data) setSources(sourcesQ.data)
  }, [sourcesQ.data])

  const dist = vizQ.data?.current

  const handleToggle = React.useCallback((type: ContextType, enabled: boolean) => {
    setSources((prev) =>
      prev.map((s) => (s.type === type ? { ...s, enabled } : s)),
    )
  }, [])

  const handleBudget = React.useCallback((type: ContextType, percent: number) => {
    setSources((prev) =>
      prev.map((s) => (s.type === type ? { ...s, budgetPercent: percent } : s)),
    )
  }, [])

  const isLoading = sourcesQ.isLoading || vizQ.isLoading

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">上下文</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            管理对话上下文源、预算分配与 Token 分布
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void sourcesQ.refetch()
            void vizQ.refetch()
          }}
        >
          <RotateCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : sourcesQ.error || vizQ.error ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>加载失败:{(sourcesQ.error ?? vizQ.error)?.message ?? '未知错误'}</span>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">当前会话 Token 分布</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {dist ? (
                <TokenPieChart distribution={dist} />
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  暂无会话数据,发起对话后再次刷新
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">上下文源</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {sources.length > 0 ? (
                <SourceList
                  sources={sources}
                  onToggle={handleToggle}
                  onBudgetChange={handleBudget}
                />
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  暂无可用源
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">子页面</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 pt-0 sm:grid-cols-3">
          {SUB_PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex flex-col gap-1 rounded-md border bg-card p-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{p.title}</p>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
