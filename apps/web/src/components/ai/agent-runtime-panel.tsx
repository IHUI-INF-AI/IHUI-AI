// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import * as React from 'react'
import {
  Bot,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Shield,
  Ban,
  Pause,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
// 暂停/继续一律走按会话的两个出口。**不得**拿 pause 响应里的 checkpoint_id 去调
// `/agents/execute/resume` —— 一次暂停会落两个检查点(`eager` 是按下暂停那一刻的快照,
// 循环随后还在轮次边界落一个更完整的暂停点),按前者续跑会**重跑一轮已经执行过的工具调用**
// (带副作用的工具重跑一次就是真实事故)。详见 api-client `AgentSessionCheckpointStage` 注释。
import {
  executeAgentRuntimeStream,
  pauseAgentSession,
  resumeAgentSession,
} from '@ihui/api-client'
import { permissionDecisionWord } from '@ihui/shared/chat'
import { Tooltip, TooltipProvider } from '@/components/feedback'
// 2026-09-14 接线 CollapsibleOutput 孤儿组件(规划 5.8 长输出折叠):运行时输出不再裸 pre-wrap 撑爆面板
import { CollapsibleOutput } from '@/components/ai/collapsible-output'

interface AgentRuntimePanelProps {
  className?: string
}

// P2 中期增强:增加 cancelled 状态,停止后给用户明确的"任务已取消"反馈
// (此前只 setStatus('idle'),用户不知道停止是否生效)
// `paused` **只在服务端确认暂停位已落**时才写(见 handlePause),端内不用"我上次点过"猜——
// 那才是第二套状态机;`idle`/`running` 仍是本地流状态。
type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

interface PermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
}

export function AgentRuntimePanel({ className }: AgentRuntimePanelProps) {
  const t = useTranslations('agentRuntimePanel')
  const tStep = useTranslations('stepDecision')
  const [status, setStatus] = React.useState<AgentStatus>('idle')
  const [input, setInput] = React.useState('')
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [plan, setPlan] = React.useState<string | null>(null)
  const [output, setOutput] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)
  const [permission, setPermission] = React.useState<PermissionEvent | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  // 在途标记只为禁用按钮,不参与"暂停/继续"的判定(那一格只认服务端答复)
  const [pausePending, setPausePending] = React.useState(false)
  // 直接存后端的 `changed`:true = 本次真的置了暂停位,false = 本来就在暂停位(幂等重复点)。
  // 它只用来选文案 —— "是不是暂停中"由 `outcome` 给,端内不得用"我上次点过"推断。
  const [pauseChanged, setPauseChanged] = React.useState(true)

  const handleSend = React.useCallback(async () => {
    const message = input.trim()
    // paused 时不接受新指令:服务端循环还挂在暂停位上,此时发新消息等于绕过续跑
    if (!message || status === 'running' || status === 'paused') return

    setStatus('running')
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await executeAgentRuntimeStream(
        { message, mode: 'default', sessionId: sessionId ?? undefined },
        {
          onSession: (data) => setSessionId(data.sessionId),
          onPlan: (data) => setPlan(data.plan),
          onDelta: (data) => setOutput((prev) => prev + data.content),
          onPermission: (data) => setPermission(data),
          onDone: (data) => {
            setStatus('completed')
            if (data.summary) setOutput(data.summary)
          },
          onError: (data) => {
            setError(data.message)
            setStatus('failed')
          },
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (controller.signal.aborted) {
        // P2 中期增强:显示"任务已取消"状态而非静默回到 idle
        setStatus('cancelled')
        // 8s 后自动回归 idle,避免 banner 长期占位
        window.setTimeout(() => {
          setStatus((prev) => (prev === 'cancelled' ? 'idle' : prev))
        }, 8000)
      } else {
        setError(String(err))
        setStatus('failed')
      }
    } finally {
      abortRef.current = null
    }
  }, [input, status, sessionId])

  const handleStop = React.useCallback(() => {
    abortRef.current?.abort()
    // P2 中期增强:停止后置为 cancelled 状态,让用户清楚知道停止操作已生效
    setStatus('cancelled')
  }, [])

  /**
   * 暂停 = 服务端在安全点把循环停住(与 `handleStop` 的"掐断本地流"是两件事,所以两个
   * 动作各留各的入口,没有互相替换)。
   *
   * 状态只从后端答复写:`outcome` 说它在暂停位上才落 `paused`。失败时**不改** `status` ——
   * 409(不在跑)/403(不是你的会话)/503(暂停位置了但没有恢复点)各有各的结论格,
   * 端内把它们一律画成"已暂停"就是把失败洗成成功。
   */
  const handlePause = React.useCallback(async () => {
    if (!sessionId || pausePending) return
    setPausePending(true)
    setError(null)
    try {
      const res = await pauseAgentSession(sessionId)
      if (!res.success) {
        // 保留后端给的定向说明(errorCode 已在 ApiResult 上,界面按消息直出即可分流由后续票做)
        setError(res.error || t('pauseUnavailable'))
        return
      }
      setStatus('paused')
      setPauseChanged(res.data.changed === true)
    } finally {
      setPausePending(false)
    }
  }, [sessionId, pausePending, t])

  /**
   * 继续 = 按**会话**续跑(服务端自己取最新暂停点),见文件头那条"不得回传 checkpoint_id"。
   * 409 AGENT_RESUME_NOT_PAUSED / 404 AGENT_RESUME_NO_CHECKPOINT 同样只报不改状态。
   */
  const handleResume = React.useCallback(async () => {
    if (!sessionId || pausePending) return
    setPausePending(true)
    setError(null)
    try {
      const res = await resumeAgentSession(sessionId)
      if (!res.success) {
        setError(res.error || t('resumeUnavailable'))
        return
      }
      // 回到 running:本地 SSE 流在暂停期间从未 abort,服务端续跑后增量照常落到这里
      setStatus('running')
    } finally {
      setPausePending(false)
    }
  }, [sessionId, pausePending, t])

  const handleClear = React.useCallback(() => {
    setStatus('idle')
    setInput('')
    setSessionId(null)
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)
  }, [])

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      <TooltipProvider>
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cta text-cta-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{t('title')}</span>
          {sessionId && (
            <Tooltip content={sessionId}>
              <span data-testid="session-id" className="truncate text-xs text-muted-foreground">
                #{sessionId.slice(0, 8)}
              </span>
            </Tooltip>
          )}
          {status === 'running' && (
            <Loader2
              data-testid="status-running"
              className="h-3.5 w-3.5 animate-spin text-primary"
            />
          )}
          {status === 'completed' && (
            <CheckCircle2 data-testid="status-completed" className="h-3.5 w-3.5 text-green-600" />
          )}
          {status === 'failed' && (
            <AlertCircle data-testid="status-failed" className="h-3.5 w-3.5 text-red-500" />
          )}
          {status === 'cancelled' && (
            <Ban data-testid="status-cancelled" className="h-3.5 w-3.5 text-zinc-500" />
          )}
          {status === 'paused' && (
            <Pause data-testid="status-paused" className="h-3.5 w-3.5 text-amber-500" />
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleClear}
            disabled={status === 'running' || status === 'paused'}
            className="rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
          >
            {t('clear')}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 thin-scroll">
          {plan && (
            <section className="mb-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" />
                {t('plan')}
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed">{plan}</pre>
            </section>
          )}

          {permission && (
            <section className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950/30">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                <Shield className="h-3 w-3" />
                {t('permissionDecision', {
                  // D55②:决策值走共享词表,认不出原样显示(此前把 auto_skip_approval 直喷给用户)
                  decision: permissionDecisionWord(permission.decision, tStep),
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('permissionMeta', {
                  tool: permission.toolName ?? t('unknownTool'),
                  level: permission.dangerLevel ?? t('defaultLevel'),
                  mode: permission.mode,
                })}
              </div>
            </section>
          )}

          {output && (
            // 2026-09-14 接线 CollapsibleOutput(规划 5.8):状态图标 + 折叠头 + CodeBlock 呈现,
            // maxCollapsedLines=10 折叠超长输出,流式期间自动展开
            <CollapsibleOutput
              title={t('output')}
              status={
                status === 'running'
                  ? 'running'
                  : status === 'failed'
                    ? 'error'
                    : status === 'completed'
                      ? 'success'
                      : 'idle'
              }
              content={output}
              maxCollapsedLines={10}
              defaultOpen
              className="mb-3"
            />
          )}

          {error && (
            <section className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-950/30">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                {t('error')}
              </div>
              <div className="mt-1 text-xs">{error}</div>
            </section>
          )}

          {/* P2 中期增强:任务被取消时显示明确提示,告知用户停止操作已生效 */}
          {status === 'cancelled' && (
            <section
              data-testid="cancelled-banner"
              // 2026-08-17 P3:dark 模式 banner 弱提示背景统一为 zinc-950/30(深一档,与代码块 token 对齐)
              className="mb-3 rounded-md border border-zinc-300 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-950/30"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <Ban className="h-3 w-3" />
                {t('cancelledTitle')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{t('cancelledBody')}</div>
            </section>
          )}

          {/* 暂停态说明:正文按后端 `changed` 选档 —— 本次真置了暂停位 vs 本来就在暂停位。
              这不是端内自己判的状态,只是把服务端给的那一格如实说出来。 */}
          {status === 'paused' && (
            <section
              data-testid="paused-banner"
              className="mb-3 rounded-md border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-700 dark:bg-amber-950/30"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Pause className="h-3 w-3" />
                {t('pausedTitle')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {pauseChanged ? t('pausedBody') : t('alreadyPausedBody')}
              </div>
            </section>
          )}

          {!plan && !output && !error && !permission && status !== 'cancelled' && status !== 'paused' && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('emptyState')}
            </div>
          )}
        </div>

        <footer className="shrink-0 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder={t('placeholder')}
              disabled={status === 'running' || status === 'paused'}
              rows={2}
              className="min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            {/* 硬停(掐断本地流)与暂停(服务端在安全点停住循环)是两件事,所以两个动作
                各留各的入口:运行中额外给一枚紧凑停止钮,主钮则分岔成 暂停 / 继续 / 执行。 */}
            {status === 'running' && (
              <button
                type="button"
                onClick={handleStop}
                aria-label={t('stop')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-500 text-white transition-colors hover:bg-red-600"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            )}
            {status === 'running' ? (
              <button
                type="button"
                onClick={handlePause}
                disabled={pausePending}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-cta px-3 text-xs font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:opacity-40"
              >
                {pausePending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
                <span>{t('pause')}</span>
              </button>
            ) : status === 'paused' ? (
              <button
                type="button"
                onClick={handleResume}
                disabled={pausePending}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-cta px-3 text-xs font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:opacity-40"
              >
                {pausePending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                <span>{t('resume')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-cta px-3 text-xs font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{t('execute')}</span>
              </button>
            )}
          </div>
        </footer>
      </TooltipProvider>
    </div>
  )
}

export default AgentRuntimePanel
