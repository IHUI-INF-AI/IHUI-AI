// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Cpu,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Bell,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { formatTimeOnly } from '@/lib/date-utils'
import { Tooltip } from '@/components/feedback'
import { useBackgroundAgentNotify } from '@/hooks/use-background-agent-notify'
import {
  getDesktopPermission,
  requestDesktopNotificationPermission,
  type DesktopPermission,
} from '@ihui/shared/notifications/notification-store'
// D64 ④(2026-09-26):后台子任务八态唯一判据源(element-pack)。端内不得再手写状态→色/图标/动作
// 的第二套 switch;stopping/stopFailed 由既有 abort 通道(cancelDispatch 的 {ok,error} 返回)本地派生。
import {
  backgroundTaskStateKey,
  backgroundTaskView,
  fromAgentStatus,
  type BackgroundTaskState,
  type ElementPackTone,
} from '@ihui/shared/chat/element-pack'
import type { BackgroundAgent } from './types'

interface BackgroundAgentsPanelProps {
  agents: BackgroundAgent[]
  loading?: boolean
  closable?: boolean
  onClose?: () => void
  onRefresh?: () => void
  /** 停止(abort)通道:返回既有 store 的 {ok,error} 结果时,面板据此派生 stopping/stopFailed;void 视为请求已受理 */
  onCancel?: (agentId: string) => Promise<{ ok: boolean; error?: string } | void> | void
  onViewResult?: (agentId: string) => void
  onPurge?: (agentId: string) => void
}

/** D64 ④:八态图标全集(判定层词汇表的端内图标映射,缺一态即 TS 报错;pending/timeout 无产生方但展示就绪) */
const TASK_STATE_ICON: Record<BackgroundTaskState, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  stopping: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
  stopFailed: <AlertTriangle className="h-4 w-4 text-red-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  cancelled: <MinusCircle className="h-4 w-4 text-zinc-400" />,
  timeout: <Clock className="h-4 w-4 text-amber-500" />,
}

/** 语义色档 → 徽章样式(与改造前 running/completed/failed/cancelled 四态逐字等价,零视觉回退) */
const TONE_BADGE_CLASS: Record<ElementPackTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-amber-500/10 text-amber-600',
  success: 'bg-emerald-500/10 text-emerald-600',
  warning: 'bg-amber-500/10 text-amber-600',
  danger: 'bg-red-500/10 text-red-600',
}

/** 语义色档 → 补充说明文字色(hint 行;仅 stopping/stopFailed/timeout 三态有 hint) */
const TONE_HINT_CLASS: Record<ElementPackTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-amber-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
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
  // D64 ④:八态标题/hint/动作文案走判定层契约键(elementPack.backgroundTask.*)
  const tb = useTranslations('ai.pane.elementPack.backgroundTask')
  // SSR 安全:首帧按未授权渲染,挂载后再读真实权限,避免 hydration 不一致
  const [permission, setPermission] = React.useState<DesktopPermission>('unsupported')
  React.useEffect(() => setPermission(getDesktopPermission()), [])

  useBackgroundAgentNotify(agents)

  // D64 ④ 停止通道本地生命周期:
  //  - stopping:停止请求在途(action=none,防重复点击)
  //  - stopFailed:既有 abort 通道返回 {ok:false} 或抛错 ⇒ 显式「停止失败」(danger),
  //    给「重试停止 / 忽略」两出口;静默吞掉 = 把停止失败伪装成已停止,子任务会在
  //    用户以为已停时继续跑(判定层 backgroundTaskView('stopFailed') 注释同义)。
  const [stoppingIds, setStoppingIds] = React.useState<ReadonlySet<string>>(new Set())
  const [stopFailedIds, setStopFailedIds] = React.useState<ReadonlySet<string>>(new Set())

  const handleStop = React.useCallback(
    async (agentId: string) => {
      setStopFailedIds((prev) => {
        if (!prev.has(agentId)) return prev
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })
      setStoppingIds((prev) => new Set(prev).add(agentId))
      try {
        const result = await onCancel?.(agentId)
        if (result && result.ok === false) {
          setStopFailedIds((prev) => new Set(prev).add(agentId))
        }
      } catch {
        setStopFailedIds((prev) => new Set(prev).add(agentId))
      } finally {
        setStoppingIds((prev) => {
          const next = new Set(prev)
          next.delete(agentId)
          return next
        })
      }
    },
    [onCancel],
  )

  /** 忽略出口:仅清本地 stopFailed 标记,子任务回到其真实底层态(仍在跑就照常显示运行中) */
  const ignoreStopFailure = React.useCallback((agentId: string) => {
    setStopFailedIds((prev) => {
      if (!prev.has(agentId)) return prev
      const next = new Set(prev)
      next.delete(agentId)
      return next
    })
  }, [])

  const enableNotifications = React.useCallback(async () => {
    await requestDesktopNotificationPermission()
    setPermission(getDesktopPermission())
  }, [])

  const stats = React.useMemo(() => {
    const s = { running: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const a of agents) {
      if (a.status in s) s[a.status as keyof typeof s]++
    }
    return s
  }, [agents])

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('title')}</span>
          {stats.running > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              {t('runningCount', { count: stats.running })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {permission === 'default' && (
            <Tooltip content={t('enableNotifications')} side="bottom">
              <Button variant="ghost" size="icon" onClick={enableNotifications}>
                <Bell className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
          {closable && (
            <Button variant="ghost" size="icon" onClick={onClose}>
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
        <ul className="space-y-1">
          {agents.map((agent) => {
            // D64 ④:每项的展示态 = 本地停止生命周期(stopping/stopFailed 优先,它们比
            // 轮询回填的底层 status 更新)⇒ 否则十态经 fromAgentStatus 归并为八态词汇
            const taskState: BackgroundTaskState = stopFailedIds.has(agent.agent_id)
              ? 'stopFailed'
              : stoppingIds.has(agent.agent_id)
                ? 'stopping'
                : fromAgentStatus(agent.status)
            const view = backgroundTaskView(taskState)
            return (
              <li key={agent.agent_id} className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{TASK_STATE_ICON[taskState]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="break-words font-mono text-xs text-muted-foreground">
                        {agent.agent_id}
                      </span>
                      <span
                        data-testid={`bg-task-state-${agent.agent_id}`}
                        data-task-state={taskState}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs font-medium',
                          TONE_BADGE_CLASS[view.tone],
                        )}
                      >
                        {tb(backgroundTaskStateKey(taskState))}
                      </span>
                      {agent.progress?.tool_calls !== null &&
                        agent.progress?.tool_calls !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {t('calls', { count: agent.progress.tool_calls })}
                          </span>
                        )}
                    </div>

                    <Tooltip content={agent.prompt} side="bottom">
                      <p className="mt-0.5 break-words text-sm">{truncate(agent.prompt, 80)}</p>
                    </Tooltip>

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

                    {view.hintKey && (
                      <p
                        data-testid={`bg-task-hint-${agent.agent_id}`}
                        className={cn('mt-0.5 break-words text-xs', TONE_HINT_CLASS[view.tone])}
                      >
                        {tb(view.hintKey)}
                      </p>
                    )}

                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeOnly(agent.updated_at || agent.created_at)}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        {/* D64 ④:动作按判定层 action 派发 —— stop=停止(pending/running);
                          retryStop=停止失败后的重试停止 + 忽略(显式,不静默吞)。
                          failed/timeout 的 action=retry 在本面板无重跑数据通道,不伪造入口。 */}
                        {view.action === 'stop' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-600"
                            onClick={() => void handleStop(agent.agent_id)}
                          >
                            {t('cancel')}
                          </Button>
                        )}
                        {view.action === 'retryStop' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-red-600 hover:text-red-600"
                              onClick={() => void handleStop(agent.agent_id)}
                            >
                              {tb('action.retryStop')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => ignoreStopFailure(agent.agent_id)}
                            >
                              {tb('action.ignore')}
                            </Button>
                          </>
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
            )
          })}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
