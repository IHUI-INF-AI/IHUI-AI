'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldCheck, ShieldAlert, Ban, Eye, Activity, RefreshCw } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Badge,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { fetchThreatDashboard, scoreClass, scoreBgClass, formatTime } from './helpers'
import type { ThreatDashboardData } from './types'

const FB: ThreatDashboardData = {
  totalChecks: 0,
  totalAutoBlocks: 0,
  totalWarnings: 0,
  watchedIps: [],
  recentBlocks: [],
}

export default function ThreatDashboardPage() {
  const t = useTranslations('admin.threatDashboard')
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'security', 'threat-dashboard'],
    queryFn: fetchThreatDashboard,
    refetchInterval: 30_000,
    retry: false,
  })

  const d = data ?? FB
  const nf = new Intl.NumberFormat('zh-CN')
  const hasData = d.watchedIps.length > 0 || d.recentBlocks.length > 0

  const stats = [
    {
      key: 'totalChecks',
      val: nf.format(d.totalChecks),
      icon: ShieldCheck,
      cls: 'bg-blue-500/10 text-blue-600',
    },
    {
      key: 'totalAutoBlocks',
      val: nf.format(d.totalAutoBlocks),
      icon: Ban,
      cls: 'bg-red-500/10 text-red-600',
    },
    {
      key: 'totalWarnings',
      val: nf.format(d.totalWarnings),
      icon: ShieldAlert,
      cls: 'bg-amber-500/10 text-amber-600',
    },
    {
      key: 'watchedIpsCount',
      val: nf.format(d.watchedIps.length),
      icon: Eye,
      cls: 'bg-emerald-500/10 text-emerald-600',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          {t('refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.key} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t(s.key)}</span>
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', s.cls)}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums">
              {isLoading ? (
                <span className="inline-block h-7 w-20 animate-pulse rounded bg-muted" />
              ) : (
                s.val
              )}
            </div>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : !hasData ? (
        <Card className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShieldCheck className="mb-3 h-10 w-10" />
          <p className="text-sm">{t('empty')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {d.watchedIps.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4 text-primary" />
                  {t('watchedIpsTitle')}
                </CardTitle>
                <CardDescription>{t('watchedIpsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t('colIp')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('colScore')}</th>
                      <th className="px-3 py-2 font-medium">{t('colReasons')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('colLastSeen')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.watchedIps.map((it, i) => (
                      <tr key={it.ip} className={cn(i % 2 === 1 && 'bg-muted/20')}>
                        <td className="px-3 py-2 font-mono text-xs">{it.ip}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-12 overflow-hidden rounded bg-muted/40">
                              <div
                                className={cn('h-full rounded', scoreBgClass(it.score))}
                                style={{ width: `${Math.min(100, it.score)}%` }}
                              />
                            </div>
                            <span
                              className={cn('font-semibold tabular-nums', scoreClass(it.score))}
                            >
                              {it.score}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {it.reasons.map((r) => (
                              <Badge key={r} variant="secondary" className="text-xs">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                          {formatTime(it.lastSeen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {d.recentBlocks.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  {t('recentBlocksTitle')}
                </CardTitle>
                <CardDescription>{t('recentBlocksDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t('colIp')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('colScore')}</th>
                      <th className="px-3 py-2 font-medium">{t('colDuration')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('colTimestamp')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recentBlocks.map((it, i) => (
                      <tr
                        key={`${it.ip}-${it.timestamp}`}
                        className={cn(i % 2 === 1 && 'bg-muted/20')}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{it.ip}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-12 overflow-hidden rounded bg-muted/40">
                              <div
                                className={cn('h-full rounded', scoreBgClass(it.score))}
                                style={{ width: `${Math.min(100, it.score)}%` }}
                              />
                            </div>
                            <span
                              className={cn('font-semibold tabular-nums', scoreClass(it.score))}
                            >
                              {it.score}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">
                            {it.duration}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                          {formatTime(it.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
