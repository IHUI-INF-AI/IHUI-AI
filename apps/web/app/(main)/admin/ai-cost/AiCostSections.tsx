'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Users, AlertTriangle, Crown, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber as fmtNum } from '@/lib/date-utils'

// ---- 类型 ----
interface TopUser {
  userId: string
  nickname: string | null
  email: string | null
  username: string | null
  totalCost: string | number
  totalTokens: number
  totalCalls: number
}
interface BudgetAlert {
  userId: string
  scopeKey: string
  dailyTokenLimit: number
  dailyTokenUsed: number
  dailyTokenPercent: number
  monthlyCostLimit: number
  monthlyCostUsed: number
  monthlyCostPercent: number
  severity: 'warning' | 'critical'
}
interface VipQuota {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  aiBudgetDefaults: {
    dailyTokenLimit: number
    monthlyTokenLimit: number
    dailyCostLimit: string
    monthlyCostLimit: string
  }
  apiQps: number
  maxConcurrency: number
  modelWhitelist: string[] | null
  activeUsers: number
}

// ---- 通用 fetch ----
async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

// ---- 显示名 ----
function displayName(u: {
  nickname: string | null
  email: string | null
  username: string | null
  userId?: string
}): string {
  return u.nickname ?? u.email ?? u.username ?? (u.userId ? u.userId.slice(0, 8) : '—')
}

// ---- 进度条 ----
function Bar({
  percent,
  severity,
}: {
  percent: number
  severity: 'warning' | 'critical' | 'normal'
}) {
  const cls =
    severity === 'critical'
      ? 'bg-red-500 dark:bg-red-400'
      : severity === 'warning'
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-primary/60'
  return (
    <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
      <div
        className={cn('h-full rounded-sm', cls)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

// =============================================================================
// 1. 用户成本排行
// =============================================================================
export function TopUsersSection({ startDate, endDate }: { startDate: string; endDate: string }) {
  const t = useTranslations('aiCost')
  const locale = useLocale()
  const curFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ai-cost', 'top-users', startDate, endDate],
    queryFn: () =>
      api<TopUser[]>(
        `/api/admin/ai/cost/top-users?startDate=${startDate}&endDate=${endDate}&limit=10`,
      ).catch(() => [] as TopUser[]),
    retry: false,
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          {t('topUsers')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noUserData')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">{t('userLabel')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('totalTokens')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('totalCalls')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('totalCost')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u, i) => (
                  <tr key={u.userId ?? i}>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-3 truncate text-xs">{displayName(u)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(u.totalTokens)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(u.totalCalls)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">
                      {curFmt.format(Number(u.totalCost) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// 2. 预算告警
// =============================================================================
export function BudgetAlertsSection() {
  const t = useTranslations('aiCost')
  const locale = useLocale()
  const curFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ai-cost', 'budget-alerts'],
    queryFn: () =>
      api<BudgetAlert[]>('/api/admin/ai/cost/budget-alerts').catch(() => [] as BudgetAlert[]),
    retry: false,
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          {t('budgetAlerts')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noAlerts')}</p>
        ) : (
          <div className="space-y-3">
            {data.map((a) => (
              <div key={a.userId} className="space-y-1.5 rounded-md border border-border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-mono text-xs">
                    {displayName({ nickname: null, email: null, username: a.scopeKey })}
                  </span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-medium',
                      a.severity === 'critical'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {a.severity === 'critical' ? t('critical') : t('warning')}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('dailyToken')}</span>
                    <span className="tabular-nums">
                      {fmtNum(a.dailyTokenUsed)} / {fmtNum(a.dailyTokenLimit)} (
                      {a.dailyTokenPercent}%)
                    </span>
                  </div>
                  <Bar
                    percent={a.dailyTokenPercent}
                    severity={a.dailyTokenPercent >= 100 ? 'critical' : 'warning'}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('monthlyCost')}</span>
                    <span className="tabular-nums">
                      {curFmt.format(a.monthlyCostUsed / 100)} /{' '}
                      {curFmt.format(a.monthlyCostLimit / 100)} ({a.monthlyCostPercent}%)
                    </span>
                  </div>
                  <Bar
                    percent={a.monthlyCostPercent}
                    severity={a.monthlyCostPercent >= 100 ? 'critical' : 'warning'}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// 3. VIP 档位配额视图
// =============================================================================
export function VipQuotasSection() {
  const t = useTranslations('aiCost')
  const locale = useLocale()
  const curFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ai-cost', 'vip-quotas'],
    queryFn: () => api<VipQuota[]>('/api/admin/ai/cost/vip-quotas').catch(() => [] as VipQuota[]),
    retry: false,
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4" />
          {t('vipQuotas')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noVipData')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('vipLevel')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('vipActiveUsers')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('vipDailyToken')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('vipMonthlyCost')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('vipApiQps')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('vipConcurrency')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          L{v.levelValue}
                        </span>
                        <span className="text-xs">{v.levelName}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(v.activeUsers)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {fmtNum(v.aiBudgetDefaults?.dailyTokenLimit ?? 0)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {curFmt.format(Number(v.aiBudgetDefaults?.monthlyCostLimit ?? 0) / 100)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{v.apiQps}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{v.maxConcurrency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
