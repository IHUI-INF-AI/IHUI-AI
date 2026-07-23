'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Loader2, RotateCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchVisualization } from '@/lib/context-api'
import { TokenPieChart } from '@/components/context/TokenPieChart'
import { TokenHistoryChart } from '@/components/context/TokenHistoryChart'

export default function ContextVisualizationPage() {
  const [conversationId, setConversationId] = React.useState('')
  const vizQ = useQuery({
    queryKey: ['context', 'visualization', conversationId],
    queryFn: () => fetchVisualization(conversationId),
  })

  const data = vizQ.data
  const events = data?.compressionEvents ?? []

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
          <h1 className="mt-1 text-xl font-bold tracking-tight">Token 可视化</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            查看当前会话 Token 分布饼图、历史趋势与压缩事件
          </p>
        </div>
        <button
          type="button"
          onClick={() => void vizQ.refetch()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCw className="h-3 w-3" />
          刷新
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">会话过滤</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            <input
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
              placeholder="输入 conversationId(留空查全部)"
              className="h-8 flex-1 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      {vizQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : vizQ.error ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>加载失败:{(vizQ.error as Error).message}</span>
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-sm text-muted-foreground">暂无数据</div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">当前分布</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <TokenPieChart distribution={data.current} size={220} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">历史趋势</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <TokenHistoryChart data={data.history} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">压缩事件({events.length})</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {events.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无压缩事件
                </div>
              ) : (
                <ol className="space-y-2">
                  {events.map((e, i) => {
                    const ratio = e.compressionRatio
                    return (
                      <li
                        key={`${e.timestamp}-${i}`}
                        className="flex items-center gap-3 rounded-md border bg-card p-2.5"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-amber-100 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {(ratio * 100).toFixed(0)}%
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">
                            {new Intl.DateTimeFormat('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(e.timestamp))}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {e.beforeTokens.toLocaleString()} → {e.afterTokens.toLocaleString()} tokens
                          </p>
                        </div>
                        <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-muted">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${Math.min(100, ratio * 100)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
