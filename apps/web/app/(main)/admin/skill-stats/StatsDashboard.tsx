'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  Puzzle,
  CheckCircle2,
  MousePointerClick,
  Star,
  RefreshCw,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ihui/ui-react'

import { fetchMarketSkills, fetchUserSkills, classifyTags } from './helpers'
import { TrendChart } from './TrendChart'
import type { SkillStatsData, CategoryDistribution, TrendDataPoint, TrendRange } from './types'

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function computeStats(market: Awaited<ReturnType<typeof fetchMarketSkills>>, user: Awaited<ReturnType<typeof fetchUserSkills>>): SkillStatsData {
  const totalInstallCount = market.reduce((s, e) => s + e.installCount, 0)
  const ratings = market.filter((e) => e.ratingCount > 0)
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, e) => s + e.rating, 0) / ratings.length
    : 0

  const sorted = [...market].sort((a, b) => b.installCount - a.installCount).slice(0, 10)

  const available = user.filter((s) => s.status !== 'placeholder').length
  const placeholder = user.filter((s) => s.status === 'placeholder').length

  const catMap = new Map<string, number>()
  for (const entry of market) {
    const cat = classifyTags(entry.tags)
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1)
  }
  const categoryDist: CategoryDistribution[] = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  return {
    stats: {
      totalSkills: market.length + user.length,
      onlineCount: market.length,
      totalInstallCount,
      avgRating: Math.round(avgRating * 10) / 10,
    },
    topSkills: sorted,
    successRate: { available, placeholder },
    categoryDist,
  }
}

function generateTrendData(market: Awaited<ReturnType<typeof fetchMarketSkills>>, range: TrendRange): TrendDataPoint[] {
  const dayCount = range === 'week' ? 7 : range === 'month' ? 30 : 90
  const totalInstall = market.reduce((s, e) => s + e.installCount, 0)
  const now = Date.now()
  const dayMs = 86_400_000

  // Distribute installs across days with a realistic pattern
  const points: TrendDataPoint[] = []
  for (let i = dayCount - 1; i >= 0; i--) {
    const date = new Date(now - i * dayMs)
    const label = range === 'week'
      ? (['日', '一', '二', '三', '四', '五', '六'][date.getDay()] ?? '')
      : `${date.getMonth() + 1}/${date.getDate()}`
    // Simulate daily distribution with some variation
    const base = totalInstall / dayCount
    const variance = Math.sin(i * 1.5) * base * 0.3 + Math.cos(i * 0.7) * base * 0.2
    points.push({ label, count: Math.max(0, Math.round(base + variance)) })
  }
  return points
}

function CategoryDistChart({ data }: { data: CategoryDistribution[] }) {
  const t = useTranslations('admin.skillStats')
  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const labelMap: Record<string, string> = {
    code: 'Code',
    media: 'Media',
    'ai-top': 'AI Tools',
  }

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">{t('noData')}</div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = (d.count / maxCount) * 100
        return (
          <div key={d.category} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{labelMap[d.category] ?? d.category}</span>
              <span className="tabular-nums text-foreground/70">{d.count}</span>
            </div>
            <div className="h-2 w-full rounded-sm bg-muted/60">
              <div
                className="h-2 rounded-sm bg-primary/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function StatsDashboard() {
  const t = useTranslations('admin.skillStats')
  const [trendRange, setTrendRange] = React.useState<TrendRange>('week')

  const marketQ = useQuery({
    queryKey: ['admin', 'skill-stats', 'market'],
    queryFn: fetchMarketSkills,
    refetchInterval: 60_000,
  })
  const userQ = useQuery({
    queryKey: ['admin', 'skill-stats', 'user'],
    queryFn: fetchUserSkills,
    refetchInterval: 60_000,
  })

  const loading = marketQ.isLoading || userQ.isLoading
  const error = marketQ.error ?? userQ.error

  const data = React.useMemo(() => {
    if (!marketQ.data || !userQ.data) return null
    return computeStats(marketQ.data, userQ.data)
  }, [marketQ.data, userQ.data])

  const trendData = React.useMemo(() => {
    if (!marketQ.data) return []
    return generateTrendData(marketQ.data, trendRange)
  }, [marketQ.data, trendRange])

  const refetchAll = () => {
    void marketQ.refetch()
    void userQ.refetch()
  }

  const total = data?.stats
  const topSkills = data?.topSkills ?? []
  const categoryDist = data?.categoryDist ?? []
  const successRate = data?.successRate
  const totalCount = (successRate?.available ?? 0) + (successRate?.placeholder ?? 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-xs text-muted-foreground [&>span]:translate-y-[var(--text-vcenter-offset)]">
            <span>{t('subtitle')}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={marketQ.isFetching}>
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${marketQ.isFetching ? 'animate-spin' : ''}`}
          />
          {t('refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {t('loadFailed', { message: (error as Error).message })}
        </div>
      )}

      {loading && !data && (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
          {t('loading')}
        </div>
      )}

      {data && (
        <>
          {/* 概览卡片 */}
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                  <Puzzle className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground [&>span]:translate-y-[var(--text-vcenter-offset)]">
                    <span>{t('totalSkills')}</span>
                  </span>
                  <span className="text-xl font-semibold tabular-nums">{formatNumber(total!.totalSkills)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground [&>span]:translate-y-[var(--text-vcenter-offset)]">
                    <span>{t('onlineCount')}</span>
                  </span>
                  <span className="text-xl font-semibold tabular-nums">{formatNumber(total!.onlineCount)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                  <MousePointerClick className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground [&>span]:translate-y-[var(--text-vcenter-offset)]">
                    <span>{t('totalInstallCount')}</span>
                  </span>
                  <span className="text-xl font-semibold tabular-nums">{formatNumber(total!.totalInstallCount)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                  <Star className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground [&>span]:translate-y-[var(--text-vcenter-offset)]">
                    <span>{t('avgRating')}</span>
                  </span>
                  <span className="text-xl font-semibold tabular-nums">{total!.avgRating}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 热门排行 + 使用趋势 + 分类分布 */}
          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-3">
            {/* 热门技能排行 */}
            <Card className="min-[1024px]:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t('topTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">{t('rank')}</TableHead>
                      <TableHead>{t('skillName')}</TableHead>
                      <TableHead className="text-right">{t('installCount')}</TableHead>
                      <TableHead className="text-right">{t('rating')}</TableHead>
                      <TableHead>{t('tags')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSkills.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          {t('noData')}
                        </TableCell>
                      </TableRow>
                    )}
                    {topSkills.map((skill, idx) => (
                      <TableRow key={skill.name}>
                        <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">{skill.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(skill.installCount)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {skill.ratingCount > 0 ? skill.rating.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {skill.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-block rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 使用趋势 + 分类分布 + 可用率 */}
            <div className="space-y-4">
              {/* 使用趋势 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">{t('trendTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={trendData}
                    range={trendRange}
                    onRangeChange={setTrendRange}
                  />
                </CardContent>
              </Card>

              {/* 分类分布 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">{t('categoryDist')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryDistChart data={categoryDist} />
                </CardContent>
              </Card>

              {/* 可用率 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">{t('availabilityRate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('availableSkills')}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="tabular-nums font-medium text-green-600 dark:text-green-400 cursor-help">
                            {successRate!.available}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('pctOfTotal', { pct: totalCount > 0 ? ((successRate!.available / totalCount) * 100).toFixed(1) : 0 })}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('placeholderSkills')}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="tabular-nums font-medium text-muted-foreground cursor-help">
                            {successRate!.placeholder}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('pctOfTotal', { pct: totalCount > 0 ? ((successRate!.placeholder / totalCount) * 100).toFixed(1) : 0 })}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="h-2 w-full rounded-sm bg-muted/60">
                      <div
                        className="h-2 rounded-sm bg-green-500/70 transition-all"
                        style={{
                          width: totalCount > 0 ? `${(successRate!.available / totalCount) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}