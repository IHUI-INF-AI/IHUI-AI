'use client'

import * as React from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'

import { cn } from '@/lib/utils'
import type { SwarmData, SwarmPerformanceMetrics, AgentStatus } from './types'

interface AgentSwarmMonitorProps {
  swarmId?: string
  swarmData?: SwarmData | null
  performanceMetrics?: SwarmPerformanceMetrics | null
  optimizationSuggestions?: string[]
  loading?: boolean
  onRefresh?: () => void
}

const STATUS_TAG: Record<AgentStatus, { label: string; cls: string }> = {
  idle: { label: '空闲', cls: 'bg-zinc-500/10 text-zinc-600' },
  pending: { label: '等待', cls: 'bg-amber-500/10 text-amber-600' },
  thinking: { label: '思考中', cls: 'bg-amber-500/10 text-amber-600' },
  acting: { label: '执行中', cls: 'bg-violet-500/10 text-violet-600' },
  reflecting: { label: '反思中', cls: 'bg-cyan-500/10 text-cyan-600' },
  waiting: { label: '等待中', cls: 'bg-amber-500/10 text-amber-600' },
  running: { label: '运行中', cls: 'bg-amber-500/10 text-amber-600' },
  completed: { label: '已完成', cls: 'bg-emerald-500/10 text-emerald-600' },
  failed: { label: '失败', cls: 'bg-red-500/10 text-red-600' },
  cancelled: { label: '已取消', cls: 'bg-zinc-500/10 text-zinc-600' },
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
  const swarm = swarmData?.swarm
  const agentList = swarmData?.agentList ?? []
  const results = swarmData?.results ?? []

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">群体监控</CardTitle>
        {swarmId && (
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            刷新
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!swarmData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {swarmId ? '加载中...' : '未启动 Swarm'}
          </p>
        ) : (
          <>
            {/* Swarm 信息 */}
            {swarm && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoItem label="Swarm ID" value={swarm.swarmId} mono />
                <InfoItem
                  label="状态"
                  value={
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        STATUS_TAG[swarm.status]?.cls,
                      )}
                    >
                      {STATUS_TAG[swarm.status]?.label ?? swarm.status}
                    </span>
                  }
                />
                <InfoItem label="任务" value={swarm.task} fullWidth />
                <InfoItem
                  label="迭代"
                  value={`${swarm.currentIteration} / ${swarm.maxIterations}`}
                />
              </div>
            )}

            {/* Agent 状态 */}
            {agentList.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Agent 状态</h4>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">名称</th>
                        <th className="px-3 py-2 text-left font-medium">类型</th>
                        <th className="px-3 py-2 text-left font-medium">状态</th>
                        <th className="px-3 py-2 text-left font-medium">当前步骤</th>
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
                                STATUS_TAG[a.status]?.cls,
                              )}
                            >
                              {STATUS_TAG[a.status]?.label ?? a.status}
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
                <h4 className="mb-2 text-sm font-medium">性能指标</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Metric
                    label="成功率"
                    value={`${(performanceMetrics.successRate * 100).toFixed(1)}%`}
                  />
                  <Metric label="平均耗时" value={`${performanceMetrics.averageStepTime}ms`} />
                  <Metric
                    label="平均 Token"
                    value={String(performanceMetrics.averageTokensPerStep)}
                  />
                  <Metric label="总步骤" value={String(performanceMetrics.totalSteps)} />
                  <Metric label="已完成" value={String(performanceMetrics.completedSteps)} />
                  <Metric label="失败" value={String(performanceMetrics.failedSteps)} />
                </div>

                {optimizationSuggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <h5 className="text-xs font-medium text-muted-foreground">优化建议</h5>
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
                <h4 className="mb-2 text-sm font-medium">执行结果</h4>
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
                            工具结果 ({r.tool_results.length})
                          </summary>
                          <div className="mt-1 space-y-1">
                            {r.tool_results.map((t) => (
                              <div key={t.toolId} className="rounded bg-muted/30 p-1.5 text-xs">
                                <span className="font-mono">{t.toolId}</span>
                                {t.result !== null && t.result !== undefined && (
                                  <pre className="mt-1 overflow-auto text-muted-foreground">
                                    {typeof t.result === 'string'
                                      ? t.result
                                      : JSON.stringify(t.result, null, 2)}
                                  </pre>
                                )}
                                {t.error && <p className="text-red-600">错误: {t.error}</p>}
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
