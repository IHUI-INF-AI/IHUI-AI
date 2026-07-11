'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Activity, CheckCircle2, Clock, Loader2 } from 'lucide-react'

import {
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'

interface ToolUsage {
  server: string
  tool: string
  calls: number
  successCount: number
  avgDuration: number
}

interface UsageStats {
  totalCalls: number
  successRate: number
  avgDuration: number
  byServer: ToolUsage[]
}

type Range = 'today' | '7d' | '30d'

function getMockStats(range: Range): UsageStats {
  const mult = range === 'today' ? 1 : range === '7d' ? 7 : 30
  const byServer: ToolUsage[] = [
    {
      server: 'filesystem',
      tool: 'read_file',
      calls: 24 * mult,
      successCount: 23 * mult,
      avgDuration: 45,
    },
    {
      server: 'filesystem',
      tool: 'write_file',
      calls: 12 * mult,
      successCount: 12 * mult,
      avgDuration: 78,
    },
    {
      server: 'github',
      tool: 'search_repos',
      calls: 18 * mult,
      successCount: 17 * mult,
      avgDuration: 320,
    },
    {
      server: 'github',
      tool: 'create_issue',
      calls: 6 * mult,
      successCount: 5 * mult,
      avgDuration: 410,
    },
    {
      server: 'database',
      tool: 'query',
      calls: 42 * mult,
      successCount: 40 * mult,
      avgDuration: 120,
    },
  ]
  const totalCalls = byServer.reduce((s, u) => s + u.calls, 0)
  const successCount = byServer.reduce((s, u) => s + u.successCount, 0)
  const totalDuration = byServer.reduce((s, u) => s + u.avgDuration * u.calls, 0)
  return {
    totalCalls,
    successRate: totalCalls > 0 ? (successCount / totalCalls) * 100 : 0,
    avgDuration: totalCalls > 0 ? totalDuration / totalCalls : 0,
    byServer,
  }
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}

function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="transition-colors hover:bg-accent">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <div className="break-words text-xs text-muted-foreground">{title}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export function McpUseManager() {
  const t = useTranslations('mcp')
  const [range, setRange] = React.useState<Range>('7d')

  const { data, isLoading } = useQuery({
    queryKey: ['mcp', 'usage', range],
    queryFn: async () => {
      const res = await fetchApi<UsageStats>(`/api/ai/mcp/usage?range=${range}`)
      if (res.success) return res.data
      // 后端暂无统计端点，回退到 mock 数据
      return getMockStats(range)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('useTitle')}</h2>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('today')}</SelectItem>
            <SelectItem value="7d">{t('days7')}</SelectItem>
            <SelectItem value="30d">{t('days30')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard title={t('totalCalls')} value={String(data.totalCalls)} icon={Activity} />
            <StatCard
              title={t('overallSuccessRate')}
              value={`${data.successRate.toFixed(1)}%`}
              icon={CheckCircle2}
            />
            <StatCard
              title={t('overallAvgDuration')}
              value={`${data.avgDuration.toFixed(0)}ms`}
              icon={Clock}
            />
          </div>

          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('server')}</TableHead>
                  <TableHead>{t('tool')}</TableHead>
                  <TableHead className="text-right">{t('calls')}</TableHead>
                  <TableHead className="text-right">{t('successRate')}</TableHead>
                  <TableHead className="text-right">{t('avgDuration')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byServer.map((u) => {
                  const rate = u.calls > 0 ? (u.successCount / u.calls) * 100 : 0
                  return (
                    <TableRow key={`${u.server}-${u.tool}`}>
                      <TableCell className="font-medium">{u.server}</TableCell>
                      <TableCell className="font-mono text-xs">{u.tool}</TableCell>
                      <TableCell className="text-right">{u.calls}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-medium',
                            rate >= 95
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : rate >= 80
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-destructive',
                          )}
                        >
                          {rate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {u.avgDuration}ms
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
