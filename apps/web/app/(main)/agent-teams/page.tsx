// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 智能体团队管理页 v1(读侧,2026-09-07 工作线 B)。
// 团队运行列表(运行中/完成/失败,数据源 GET /api/subagents/all)+ 运行详情
// (成员角色活动流 SubAgentActivityFeed + Swarm 拓扑 SwarmTopologyView)。
// 写侧(发起团队协作)由 /orchestration 团队编排承担,本页仅回看。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, UsersRound } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  getAllSubagentDispatches,
  getSubagentStats,
  type SubagentDispatch,
  type SubagentGlobalStats,
} from '@ihui/api-client'
import { RunDetail } from './run-detail'

type StatusFilter = 'all' | 'running' | 'completed' | 'failed'

const FILTERS: readonly StatusFilter[] = ['all', 'running', 'completed', 'failed']

const FILTER_STATUS_SET: Record<Exclude<StatusFilter, 'all'>, readonly string[]> = {
  running: ['pending', 'running', 'paused'],
  completed: ['completed'],
  failed: ['failed', 'cancelled'],
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  running: 'bg-amber-500',
  paused: 'bg-amber-400',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  cancelled: 'bg-muted-foreground/50',
}

export default function AgentTeamsPage() {
  const t = useTranslations('agentTeams')
  const [stats, setStats] = React.useState<SubagentGlobalStats | null>(null)
  const [dispatches, setDispatches] = React.useState<SubagentDispatch[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [allRes, statsRes] = await Promise.all([
        getAllSubagentDispatches({ limit: 200 }),
        getSubagentStats().catch(() => null),
      ])
      setDispatches(allRes.dispatches)
      setStats(statsRes)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = React.useMemo(() => {
    if (filter === 'all') return dispatches
    const allowed = FILTER_STATUS_SET[filter]
    return dispatches.filter((d) => allowed.includes(d.status))
  }, [dispatches, filter])

  const selected = React.useMemo(
    () => dispatches.find((d) => d.id === selectedId) ?? null,
    [dispatches, selectedId],
  )

  const statChips: { label: string; value: number }[] = [
    { label: t('statsTotal'), value: stats?.total ?? stats?.totalDispatches ?? dispatches.length },
    { label: t('statsActive'), value: stats?.active ?? 0 },
    { label: t('statsCompleted'), value: stats?.completed ?? 0 },
    { label: t('statsFailed'), value: stats?.failed ?? 0 },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <UsersRound className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          aria-label={t('refresh')}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* 全局统计 */}
      <div className="mb-4 grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
        {statChips.map((chip) => (
          <div key={chip.label} className="rounded-lg border bg-card p-3">
            <div className="text-lg font-semibold tabular-nums">{chip.value}</div>
            <div className="text-xs text-muted-foreground">{chip.label}</div>
          </div>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* 状态筛选 + 列表/详情双栏 */}
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const FILTER_LABEL: Record<StatusFilter, string> = {
            all: t('filter.all'),
            running: t('filter.running'),
            completed: t('filter.completed'),
            failed: t('filter.failed'),
          }
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs transition-colors',
                filter === f
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {FILTER_LABEL[f]}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 rounded-xl border p-3 lg:w-96">
          {loading && dispatches.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul className="max-h-[32rem] space-y-1 overflow-y-auto thin-scroll">
              {filtered.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      'w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-accent',
                      selectedId === d.id && 'bg-accent',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          STATUS_DOT[d.status] ?? 'bg-muted-foreground/50',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {d.goal || d.id}
                      </span>
                    </div>
                    <div className="mt-0.5 pl-4 text-[10px] text-muted-foreground">
                      {[d.agentRole, d.orchestration, d.updatedAt].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <RunDetail dispatch={selected} />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-center rounded-xl border p-10 text-sm text-muted-foreground">
            {t('selectHint')}
          </div>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
