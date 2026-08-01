'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Wallet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Server,
} from 'lucide-react'

import { fetchProvidersAvailability } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

/** 状态 → 显示配置 */
type StatusConfig = {
  label: string
  color: string
  icon: React.ComponentType<{ className?: string }>
}
const STATUS_CONFIG: Record<string, StatusConfig> = {
  healthy: { label: '健康', color: 'text-emerald-600', icon: CheckCircle2 },
  degraded: { label: '降级', color: 'text-amber-600', icon: AlertTriangle },
  down: { label: '不可用', color: 'text-red-600', icon: XCircle },
  not_configured: { label: '未配置', color: 'text-muted-foreground', icon: XCircle },
  local: { label: '本地', color: 'text-emerald-600', icon: Server },
  zero_cost: { label: '免费', color: 'text-emerald-600', icon: CheckCircle2 },
  pending: { label: '检测中', color: 'text-muted-foreground', icon: Loader2 },
}

/** 获取状态配置(保证返回非 undefined) */
function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending!
}

/** 错误类型 → 显示文案 */
const ERROR_TYPE_LABEL: Record<string, string> = {
  payment_required: '余额不足(需充值)',
  forbidden: '无权限/key 失效',
  rate_limited: '限流',
  timeout: '超时',
  network_error: '网络错误',
  invalid_key: 'key 无效',
  unknown: '未知错误',
  none: '',
}

export default function ProvidersHealthPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'providers-availability'],
    queryFn: () => fetchProvidersAvailability(),
    refetchInterval: 30_000, // 30s 自动刷新
  })

  const providers = data?.providers ?? []
  const summary = data?.summary

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" />
            Provider 余额与健康状态
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            实时检测各 LLM Provider 的可用性、余额和错误状态,账户没钱的 Provider
            自动隐藏不显示给用户。
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          刷新
        </button>
      </div>

      {/* 摘要卡片 */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-6">
          <SummaryCard label="总计" value={summary.total} color="text-foreground" />
          <SummaryCard label="健康" value={summary.healthy} color="text-emerald-600" />
          <SummaryCard label="降级" value={summary.degraded} color="text-amber-600" />
          <SummaryCard label="不可用" value={summary.down} color="text-red-600" />
          <SummaryCard label="本地" value={summary.local} color="text-emerald-600" />
          <SummaryCard label="免费" value={summary.zero_cost} color="text-emerald-600" />
        </div>
      )}

      {/* Provider 列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Provider 明细</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : providers.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            暂无 Provider 数据
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">余额</th>
                  <th className="px-4 py-2.5 font-medium">延迟</th>
                  <th className="px-4 py-2.5 font-medium">错误类型</th>
                  <th className="px-4 py-2.5 font-medium">错误详情</th>
                  <th className="px-4 py-2.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {providers.map((p) => {
                  const cfg = getStatusConfig(p.status)
                  const needsRecharge =
                    p.error_type === 'payment_required' || (p.balance !== null && p.balance <= 0)
                  return (
                    <tr key={p.provider_code} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{p.provider_code}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center gap-1', cfg.color)}>
                          <cfg.icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {p.balance !== null ? (
                          <span
                            className={cn(
                              'font-medium',
                              p.balance > 0 ? 'text-emerald-600' : 'text-red-600',
                            )}
                          >
                            {p.balance.toFixed(4)} {p.balance_currency ?? ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.latency_ms > 0 ? `${p.latency_ms}ms` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.error_type !== 'none' && p.error_type ? (
                          <span className="text-red-600">
                            {ERROR_TYPE_LABEL[p.error_type] ?? p.error_type}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">
                        {p.error || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {needsRecharge && p.recharge_url ? (
                          <a
                            href={p.recharge_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            去充值
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : p.recharge_url ? (
                          <a
                            href={p.recharge_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            控制台
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/** 摘要小卡片 */
function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', color)}>{value}</div>
      </CardContent>
    </Card>
  )
}
