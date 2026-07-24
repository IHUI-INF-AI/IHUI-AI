'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, AlertCircle, List, Network } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { SwarmTopologyView } from '@/components/ai/swarm-topology-view'
import type { SwarmData, SwarmPerformanceMetrics, AgentStatus } from './types'

interface AgentSwarmMonitorProps {
  swarmId?: string
  swarmData?: SwarmData | null
  performanceMetrics?: SwarmPerformanceMetrics | null
  optimizationSuggestions?: string[]
  loading?: boolean
  onRefresh?: () => void
}

const STATUS_CLASS: Record<AgentStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-500/10 text-amber-600',
  thinking: 'bg-amber-500/10 text-amber-600',
  acting: 'bg-violet-500/10 text-violet-600',
  reflecting: 'bg-cyan-500/10 text-cyan-600',
  waiting: 'bg-amber-500/10 text-amber-600',
  running: 'bg-amber-500/10 text-amber-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
  cancelled: 'bg-muted text-muted-foreground',
}

/**
 * AgentSwarmMonitor - 多 Agent 群体监控面板
 * 展示 Swarm 状态、Agent 列表、性能指标、执行结果
 */
export function AgentSwarmMonitor({
  swarmId,
  swarmData,
  performanceMetrics,
  optimizationSuggestions = [],
  loading = false,
  onRefresh,
}: AgentSwarmMonitorProps) {
  const t = useTranslations('ai.swarmMonitor')
  const ts = useTranslations('ai.status')
  const swarm = swarmData?.swarm
  const agentList = swarmData?.agentList ?? []
  const results = swarmData?.results ?? []
  // 视图切换:列表视图 / 拓扑视图(2026-07-22 立,对标 Trae Subagent mesh 拓扑)
  const [viewMode, setViewMode] = React.useState<'list' | 'topology'>('list')

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <div className="flex items-center gap-1">
          {/* 视图切换按钮组(列表 / 拓扑,2026-07-22 立) */}
          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="列表视图"
              aria-pressed={viewMode === 'list'}
              className={cn(
                'flex h-7 items-center gap-1 px-2 text-xs transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <List className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('topology')}
              aria-label="拓扑视图"
              aria-pressed={viewMode === 'topology'}
              className={cn(
                'flex h-7 items-center gap-1 px-2 text-xs transition-colors border-l border-border',
                viewMode === 'topology'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Network className="h-3 w-3" />
            </button>
          </div>
          {swarmId && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {t('refresh')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!swarmData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {swarmId ? t('loading') : t('notStarted')}
          </p>
        ) : viewMode === 'topology' ? (
          /* 拓扑视图(2026-07-22 立,对标 Trae Subagent mesh 拓扑可视化) */
          <SwarmTopologyView />
        ) : (
          <>
            {/* Swarm 信息 */}
            {swarm && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoItem label={t('swarmId')} value={swarm.swarmId} mono />
                <InfoItem
                  label={t('status')}
                  value={
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        STATUS_CLASS[swarm.status],
                      )}
                    >
                      {ts(swarm.status)}
                    </span>
                  }
                />
                <InfoItem label={t('task')} value={swarm.task} fullWidth />
                <InfoItem
                  label={t('iteration')}
                  value={`${swarm.currentIteration} / ${swarm.maxIterations}`}
                />
              </div>
            )}

            {/* Agent 状态 */}
            {agentList.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">{t('agentStatus')}</h4>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t('name')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('type')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('status')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('currentStep')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentList.map((a, idx) => (
                        <tr key={`${a.name}-${idx}`} className="border-t">
                          <td className="px-3 py-2 font-medium">{a.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{a.type}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs font-medium',
                                STATUS_CLASS[a.status],
                              )}
                            >
                              {ts(a.status)}
                            </span>
                          </td>
                          <td className="max-w-xs break-words px-3 py-2 text-muted-foreground">
                            {a.currentStep || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 性能指标 */}
            {performanceMetrics && (
              <div>
                <h4 className="mb-2 text-sm font-medium">{t('performanceMetrics')}</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Metric
                    label={t('successRate')}
                    value={`${(performanceMetrics.successRate * 100).toFixed(1)}%`}
                  />
                  <Metric label={t('avgTime')} value={`${performanceMetrics.averageStepTime}ms`} />
                  <Metric
                    label={t('avgTokens')}
                    value={String(performanceMetrics.averageTokensPerStep)}
                  />
                  <Metric label={t('totalSteps')} value={String(performanceMetrics.totalSteps)} />
                  <Metric
                    label={t('completed')}
                    value={String(performanceMetrics.completedSteps)}
                  />
                  <Metric label={t('failed')} value={String(performanceMetrics.failedSteps)} />
                </div>

                {optimizationSuggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <h5 className="text-xs font-medium text-muted-foreground">
                      {t('optimizationSuggestions')}
                    </h5>
                    {optimizationSuggestions.map((s, i) => (
                      <div
                        key={`suggestion-${i}`}
                        className="flex items-start gap-2 rounded-md bg-primary/5 p-2 text-xs"
                      >
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 执行结果 */}
            {results.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">{t('executionResults')}</h4>
                <div className="space-y-2">
                  {results.map((r) => (
                    <div key={r.step_id} className="rounded-lg border p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.step_action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {r.result && <p className="mt-1 text-xs text-muted-foreground">{r.result}</p>}
                      {r.error_message && (
                        <p className="mt-1 text-xs text-red-600">{r.error_message}</p>
                      )}
                      {r.tool_results && r.tool_results.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            {t('toolResults', { count: r.tool_results.length })}
                          </summary>
                          <div className="mt-1 space-y-1">
                            {r.tool_results.map((tr) => (
                              <div key={tr.toolId} className="rounded bg-muted/30 p-1.5 text-xs">
                                <span className="font-mono">{tr.toolId}</span>
                                {tr.result !== null && tr.result !== undefined && (
                                  <pre className="mt-1 overflow-auto text-muted-foreground">
                                    {typeof tr.result === 'string'
                                      ? tr.result
                                      : JSON.stringify(tr.result, null, 2)}
                                  </pre>
                                )}
                                {tr.error && (
                                  <p className="text-red-600">
                                    {t('error', { message: tr.error })}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function InfoItem({
  label,
  value,
  fullWidth,
  mono,
}: {
  label: string
  value: React.ReactNode
  fullWidth?: boolean
  mono?: boolean
}) {
  return (
    <div className={cn('rounded-md border bg-muted/20 px-2.5 py-1.5', fullWidth && 'col-span-2')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 break-words text-sm font-medium', mono && 'font-mono')}>
        {value}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

export default AgentSwarmMonitor
