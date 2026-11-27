// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { X, Cpu, KeyRound, RefreshCw, ExternalLink } from 'lucide-react'
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'
import { formatCompact } from '@/lib/number-format'
import { GradeBadge } from './AiModelGradeBadge'
import { api } from './helpers'
import { formatCost, formatDateTime, formatLatency, formatPercent } from './telemetry-format'
import type {
  AiModelGovernance,
  AiModelModelsTelemetry,
  ModelRow,
  RecentAiModelCall,
  TelemetryWindow,
} from './types'

interface Props {
  configId: number
  row: ModelRow | undefined
  governance?: AiModelGovernance
  onClose: () => void
}

const WINDOWS: TelemetryWindow[] = ['1h', '24h', '7d']

export function AiModelDrawer({ configId, row, governance, onClose }: Props) {
  const locale = useLocale()
  const [window, setWindow] = React.useState<TelemetryWindow>('24h')
  const [model, setModel] = React.useState<string | null>(null)
  React.useEffect(() => {
    setModel(null)
  }, [configId])
  const pool = governance?.byConfig[String(configId)]?.accountPool
  const runtimeMode = governance?.byConfig[String(configId)]?.runtimeMode
  const runtimeLabel =
    runtimeMode === 'account_pool'
      ? '账号池'
      : runtimeMode === 'local_bridge'
        ? '本机桥'
        : runtimeMode === 'mock'
          ? 'Mock'
          : runtimeMode === 'http'
            ? 'HTTP'
            : null

  const modelsQuery = useQuery({
    queryKey: ['admin', 'ai-model-config', 'telemetry', 'models', configId, window],
    queryFn: () =>
      api<AiModelModelsTelemetry>(
        `/api/admin/ai-model-config/telemetry/models?configId=${configId}&window=${window}`,
      ),
    staleTime: 15_000,
  })

  const callsQuery = useQuery({
    queryKey: ['admin', 'ai-model-config', 'telemetry', 'calls', configId, window, model],
    queryFn: () => {
      const qs = new URLSearchParams({
        configId: String(configId),
        window,
        limit: '50',
      })
      if (model) qs.set('model', model)
      return api<RecentAiModelCall[]>(`/api/admin/ai-model-config/telemetry/calls?${qs.toString()}`)
    },
    staleTime: 15_000,
  })

  const models = modelsQuery.data?.models ?? []
  const calls = callsQuery.data ?? []
  const totalCalls = models.reduce((sum, item) => sum + item.calls, 0)
  const totalTokens = models.reduce((sum, item) => sum + item.tokens, 0)
  const totalErrors = models.reduce((sum, item) => sum + item.errors, 0)

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-4xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="truncate text-title">
                {row?.name ?? `配置 #${configId}`}
              </SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Cpu className="h-3.5 w-3.5" />
                  {row?.providerCode ?? '—'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  {row?.hasApiKey ? '已配 Key' : '未配 Key'}
                </span>
                {runtimeLabel && (
                  <span className="rounded border border-border px-1.5 py-0.5">{runtimeLabel}</span>
                )}
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-0.5',
                    row?.enabled
                      ? 'border-emerald-500/30 text-emerald-700'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {row?.enabled ? '启用' : '停用'}
                </span>
              </div>
              {row?.baseUrl && (
                <a
                  href={row.baseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-label text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{row.baseUrl}</span>
                </a>
              )}
              {pool && (
                <div className="mt-1 text-label text-muted-foreground">
                  账号池：运营可用{' '}
                  <span
                    className={
                      pool.opsHealthy > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-destructive'
                    }
                  >
                    {pool.opsHealthy}/{pool.opsTotal}
                  </span>
                  {pool.sharedToOps > 0 && `（含共享 ${pool.sharedToOps} 个个人号）`}
                  {' · '}个人号 {pool.personalHealthy}/{pool.personalTotal}
                  {pool.opsTotal === 0 && (
                    <span className="ml-1 text-destructive">（公开档位没有运营号可调度）</span>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {WINDOWS.map((value) => (
                <Button
                  key={value}
                  size="xs"
                  variant={window === value ? 'default' : 'ghost'}
                  className="h-7 px-2 text-label"
                  onClick={() => {
                    setWindow(value)
                    setModel(null)
                  }}
                >
                  {value}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                void modelsQuery.refetch()
                void callsQuery.refetch()
              }}
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5',
                  (modelsQuery.isFetching || callsQuery.isFetching) && 'animate-spin',
                )}
              />
              刷新
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="调用" value={formatNumber(totalCalls)} />
            <Metric label="Token" value={formatCompact(totalTokens, locale)} />
            <Metric
              label="错误"
              value={formatNumber(totalErrors)}
              tone={totalErrors > 0 ? 'text-destructive' : undefined}
            />
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-body font-semibold text-foreground">模型级遥测</h3>
              {model && (
                <Button variant="ghost" size="xs" onClick={() => setModel(null)}>
                  清除模型筛选：{model}
                </Button>
              )}
            </div>
            {modelsQuery.isError ? (
              <Empty text="模型级遥测读取失败。" />
            ) : models.length === 0 ? (
              <Empty text="该配置在所选窗口内没有模型调用。" />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table className="min-w-[720px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">模型</TableHead>
                      <TableHead className="min-w-[84px] text-right">调用</TableHead>
                      <TableHead className="min-w-[80px] text-right">错误率</TableHead>
                      <TableHead className="min-w-[68px] text-right">P95</TableHead>
                      <TableHead className="min-w-[68px] text-right">TTFT</TableHead>
                      <TableHead className="min-w-[84px] text-right">成本</TableHead>
                      <TableHead className="min-w-[88px]">评级</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.map((item) => (
                      <TableRow
                        key={item.model}
                        className="cursor-pointer"
                        onClick={() => setModel(item.model)}
                      >
                        <TableCell className="min-w-[220px] max-w-[22rem] whitespace-nowrap">
                          <span className="block truncate font-mono text-label" title={item.model}>
                            {item.displayName || item.model}
                          </span>
                          {(item.displayName ||
                            item.isRelayPublic ||
                            item.configured === false ||
                            item.enabled === false) && (
                            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                              {item.displayName && (
                                <span className="truncate font-mono">{item.model}</span>
                              )}
                              {item.isRelayPublic && (
                                <span className="rounded border border-emerald-500/30 px-1 text-emerald-700 dark:text-emerald-400">
                                  公开
                                </span>
                              )}
                              {item.enabled === false && (
                                <span className="rounded border border-border px-1">停用</span>
                              )}
                              {item.configured === false && (
                                <span className="rounded border border-amber-500/30 px-1 text-amber-700 dark:text-amber-400">
                                  未登记
                                </span>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[84px] whitespace-nowrap text-right tabular-nums">
                          {item.calls === 0 ? (
                            <span className="text-muted-foreground">未调用</span>
                          ) : (
                            formatNumber(item.calls)
                          )}
                        </TableCell>
                        <TableCell className="min-w-[80px] whitespace-nowrap text-right tabular-nums">
                          {formatPercent(item.errorRate, locale)}
                        </TableCell>
                        <TableCell className="min-w-[68px] whitespace-nowrap text-right tabular-nums">
                          {formatLatency(item.p95LatencyMs, locale) ?? '—'}
                        </TableCell>
                        <TableCell className="min-w-[68px] whitespace-nowrap text-right tabular-nums">
                          {formatLatency(item.ttftP95Ms, locale) ?? '—'}
                        </TableCell>
                        <TableCell className="min-w-[84px] whitespace-nowrap text-right tabular-nums">
                          {item.pricedCalls > 0 ? formatCost(item.costCents, locale) : '—'}
                        </TableCell>
                        <TableCell className="min-w-[88px] whitespace-nowrap">
                          <GradeBadge grade={item.grade} size="sm" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-body font-semibold text-foreground">
              最近调用
              <span className="ml-2 text-label font-normal text-muted-foreground">
                {model ? `模型 ${model}` : '全部模型'} · 最多 50 条
              </span>
            </h3>
            {callsQuery.isError ? (
              <Empty text="调用明细读取失败。" />
            ) : calls.length === 0 ? (
              <Empty text="所选窗口内没有调用明细。" />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table className="min-w-[560px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>模型</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">延迟</TableHead>
                      <TableHead className="text-right">Token</TableHead>
                      <TableHead>错误</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="whitespace-nowrap text-label tabular-nums text-muted-foreground">
                          {formatDateTime(call.createdAt, locale)}
                        </TableCell>
                        <TableCell className="max-w-[16rem]">
                          <span className="block truncate font-mono text-label" title={call.model}>
                            {call.model}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-1.5 py-0.5 text-[11px]',
                              call.status === 'success'
                                ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                : 'border-destructive/30 text-destructive',
                            )}
                          >
                            {call.status}
                            {call.httpStatus ? ` ${call.httpStatus}` : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatLatency(call.latencyMs, locale) ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(call.totalTokens)}
                        </TableCell>
                        <TableCell className="max-w-[12rem]">
                          <span
                            className="block truncate text-label text-muted-foreground"
                            title={call.errorMessage ?? undefined}
                          >
                            {call.errorMessage ?? (call.retryable ? '可重试' : '—')}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-label text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-title font-semibold tabular-nums', tone)}>{value}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-label text-muted-foreground">
      {text}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
