'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Cpu, RefreshCw, X, Loader2, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { Button } from '@ihui/ui'

import { cn } from '@/lib/utils'
import { dateFormat } from '@/lib/date-utils'
import type { BackgroundAgent, AgentStatus } from './types'

interface BackgroundAgentsPanelProps {
  agents: BackgroundAgent[]
  loading?: boolean
  closable?: boolean
  onClose?: () => void
  onRefresh?: () => void
  onCancel?: (agentId: string) => void
  onViewResult?: (agentId: string) => void
  onPurge?: (agentId: string) => void
}

const STATUS_ICON: Partial<Record<AgentStatus, React.ReactNode>> = {
  running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  cancelled: <MinusCircle className="h-4 w-4 text-zinc-400" />,
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

/**
 * BackgroundAgentsPanel - 后台 Agent 面板
 * 显示后台运行的 Agent 列表，支持取消/查看结果/删除
 */
export function BackgroundAgentsPanel({
  agents,
  loading = false,
  closable = false,
  onClose,
  onRefresh,
  onCancel,
  onViewResult,
  onPurge,
}: BackgroundAgentsPanelProps) {
  const t = useTranslations('ai.backgroundAgents')
  const ts = useTranslations('ai.status')
  const stats = React.useMemo(() => {
    const s = { running: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const a of agents) {
      if (a.status in s) s[a.status as keyof typeof s]++
    }
    return s
  }, [agents])

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('title')}</span>
          {stats.running > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              {t('runningCount', { count: stats.running })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
          {closable && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
          <Cpu className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y">
          {agents.map((agent) => (
            <li key={agent.agent_id} className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{STATUS_ICON[agent.status]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="break-words font-mono text-xs text-muted-foreground">
                      {agent.agent_id}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        agent.status === 'running' && 'bg-amber-500/10 text-amber-600',
                        agent.status === 'completed' && 'bg-emerald-500/10 text-emerald-600',
                        agent.status === 'failed' && 'bg-red-500/10 text-red-600',
                        agent.status === 'cancelled' && 'bg-zinc-500/10 text-zinc-600',
                      )}
                    >
                      {ts(agent.status)}
                    </span>
                    {agent.progress?.tool_calls !== null &&
                      agent.progress?.tool_calls !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('calls', { count: agent.progress.tool_calls })}
                        </span>
                      )}
                  </div>

                  <p className="mt-0.5 break-words text-sm" title={agent.prompt}>
                    {truncate(agent.prompt, 80)}
                  </p>

                  {agent.status === 'running' && agent.progress?.text_preview && (
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">
                      {truncate(agent.progress.text_preview, 100)}
                    </p>
                  )}

                  {agent.result?.output && agent.status === 'completed' && (
                    <p className="mt-0.5 break-words text-xs text-emerald-600">
                      {truncate(agent.result.output, 100)}
                    </p>
                  )}

                  {agent.error && (
                    <p className="mt-0.5 break-words text-xs text-red-600">{agent.error}</p>
                  )}

                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {dateFormat(agent.updated_at || agent.created_at, 'HH:mm:ss')}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      {agent.status === 'running' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-600"
                          onClick={() => onCancel?.(agent.agent_id)}
                        >
                          {t('cancel')}
                        </Button>
                      )}
                      {agent.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onViewResult?.(agent.agent_id)}
                        >
                          {t('viewResult')}
                        </Button>
                      )}
                      {agent.status !== 'running' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onPurge?.(agent.agent_id)}
                        >
                          {t('delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {agents.length > 0 && (
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>{t('total', { count: agents.length })}</span>
          {stats.completed > 0 && <span>{t('completedCount', { count: stats.completed })}</span>}
          {stats.failed > 0 && <span>{t('failedCount', { count: stats.failed })}</span>}
          {stats.cancelled > 0 && <span>{t('cancelledCount', { count: stats.cancelled })}</span>}
        </div>
      )}
    </div>
  )
}

export default BackgroundAgentsPanel
