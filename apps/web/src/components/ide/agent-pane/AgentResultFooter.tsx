// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:底部结果 + 控制区从 agent-pane.tsx 抽出
import { useTranslations } from 'next-intl'
import { Tooltip, TooltipProvider } from '@/components/feedback'
import {
  Trash2,
  AlertCircle,
  CheckCircle2,
  Square,
  XCircle,
  HelpCircle,
  CircleDot,
  Pause,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResultTone } from './model'
import type { AgentRunPauseFailure } from '@/hooks/use-agent-run-pause'

/**
 * 结果区的色调。此前恒挂「绿色对勾」,于是"独立校验判未达成 / 判不了"的运行也会顶着一格
 * 绿勾 —— 用户读到的是"完成",与闸门结论相反。现由 done 帧的档位决定(model.ts 单一算点)。
 */
const TONE_ICON: Record<ResultTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  failure: XCircle,
  warning: HelpCircle,
}

const TONE_CLASS: Record<ResultTone, string> = {
  success: 'text-emerald-500',
  failure: 'text-destructive',
  warning: 'text-amber-500',
}

export interface AgentResultFooterProps {
  error: string | null
  result: string
  isRunning: boolean
  taskId: string | null
  /** 缺省按 success 处理(非 goal 运行的既有观感零变更) */
  tone?: ResultTone
  onStop: () => void
  onClear: () => void
  /**
   * 后端确认的暂停态(V3 #65)。**只由 `/agents/{sid}/pause|resume` 的成功结论写入**,
   * 与 `isRunning` 是两个维度:暂停后循环在轮次边界收尾,这段时间里 running 仍为真、
   * 而"已暂停"也必须同时可见 —— 把两者并成一个枚举就会丢这一格。
   */
  isPaused?: boolean
  /** 暂停/继续请求在途:只用于禁用按钮,不参与状态结论 */
  pending?: 'pause' | 'resume' | null
  /** 还没从服务端帧里拿到 session_id ⇒ 暂停无从寻址,置灰而不是"点了再报错" */
  pauseAvailable?: boolean
  onPause?: () => void
  onResume?: () => void
  /** 暂停/继续的失败格(与"运行本身失败"分开呈现,两条处置动作不同) */
  controlFailure?: AgentRunPauseFailure | null
}

export function AgentResultFooter({
  error,
  result,
  isRunning,
  taskId,
  tone = 'success',
  onStop,
  onClear,
  isPaused = false,
  pending = null,
  pauseAvailable = false,
  onPause,
  onResume,
  controlFailure = null,
}: AgentResultFooterProps) {
  const t = useTranslations('ide')
  const ToneIcon = TONE_ICON[tone]

  // 「暂停」按钮本体(拿到 session_id 之前它按不了;按不了就得说清为什么 ——
  // 只在禁用态外面套 Tooltip,避免"能用时 hover 出一个空气泡")
  const pauseButton = (
    <button
      type="button"
      onClick={onPause}
      disabled={!isRunning || !pauseAvailable || pending !== null}
      aria-busy={pending === 'pause'}
      className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      data-testid="agent-pane-pause-btn"
    >
      <Pause className="h-3 w-3" aria-hidden />
      <span>{t('agentPane.pause')}</span>
    </button>
  )

  return (
    // 本组件自带 TooltipProvider(与 agent-runtime-panel.tsx 同形):它在两处用 Tooltip
    // (任务 id / "暂停为何现在按不了"),而调用方 AgentPane 的树上没有任何 Provider ——
    // Radix 缺 Provider 时是直接抛错、不是静默少一个气泡,"能渲染"不该依赖别人家的布局。
    <TooltipProvider>
    <div className="shrink-0 space-y-2 bg-card p-2">
      {error && (
        <div
          className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
          role="alert"
          data-testid="agent-pane-error"
        >
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="flex-1 break-all">{error}</span>
        </div>
      )}
      {!error && result && (
        <div
          className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-foreground/90"
          data-testid="agent-pane-result"
          data-tone={tone}
        >
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <ToneIcon className={cn('h-3 w-3', TONE_CLASS[tone])} aria-hidden />
            <span>{t('agentPane.result')}</span>
          </div>
          <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/80">
            {result}
          </pre>
        </div>
      )}
      {controlFailure && (
        <div
          className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-600 dark:text-amber-500"
          role="alert"
          data-testid="agent-pane-control-error"
          data-action={controlFailure.action}
          data-status={controlFailure.status ?? ''}
          data-error-code={controlFailure.errorCode ?? ''}
        >
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="flex-1 break-all">
            {controlFailure.action === 'pause'
              ? t('agentPane.pauseFailed', { message: controlFailure.message })
              : t('agentPane.resumeFailed', { message: controlFailure.message })}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {/* 运行态必须**用文字**说得出口:只靠颜色/图标区分,色觉与读屏两条路都断了 */}
        {isPaused ? (
          <span
            className="inline-flex h-6 items-center gap-1 rounded-md bg-amber-500/10 px-2 text-[11px] font-medium text-amber-600 dark:text-amber-500"
            data-testid="agent-pane-phase"
            data-phase="paused"
          >
            <Pause className="h-3 w-3" aria-hidden />
            <span>{t('agentPane.paused')}</span>
          </span>
        ) : isRunning ? (
          <span
            className="inline-flex h-6 items-center gap-1 rounded-md bg-muted/50 px-2 text-[11px] font-medium text-muted-foreground"
            data-testid="agent-pane-phase"
            data-phase="running"
          >
            <CircleDot className="h-3 w-3" aria-hidden />
            <span>{t('agentPane.running')}</span>
          </span>
        ) : null}
        {/* 分岔:已暂停 ⇒ 唯一出路是「继续」;运行中 ⇒ 「暂停」(运行/暂停两态可分辨,
            见上方 phase 徽章)。暂停只在拿到 session_id 后才可用 —— 没有寻址键就点了报错,
            那是把"还不知道"伪装成"能做到"。 */}
        {isPaused ? (
          <button
            type="button"
            onClick={onResume}
            disabled={pending !== null}
            aria-busy={pending === 'resume'}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="agent-pane-resume-btn"
          >
            <Play className="h-3 w-3" aria-hidden />
            <span>{t('agentPane.resume')}</span>
          </button>
        ) : pauseAvailable ? (
          pauseButton
        ) : (
          <Tooltip content={t('agentPane.pauseUnavailable')}>{pauseButton}</Tooltip>
        )}
        <button
          type="button"
          onClick={onStop}
          disabled={!isRunning}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="agent-pane-stop-btn"
        >
          <Square className="h-3 w-3" aria-hidden />
          <span>{t('agentPane.stop')}</span>
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isRunning}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="agent-pane-clear-btn"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          <span>{t('agentPane.clear')}</span>
        </button>
        {taskId && (
          <Tooltip content={taskId}>
            <span className="ml-auto truncate text-[10px] text-muted-foreground/60">
              {t('agentPane.taskId')}: {taskId.slice(0, 8)}
            </span>
          </Tooltip>
        )}
      </div>
    </div>
    </TooltipProvider>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
