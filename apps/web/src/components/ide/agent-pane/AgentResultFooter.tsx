// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:底部结果 + 控制区从 agent-pane.tsx 抽出
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { Trash2, AlertCircle, CheckCircle2, Square, XCircle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResultTone } from './model'

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
}

export function AgentResultFooter({
  error,
  result,
  isRunning,
  taskId,
  tone = 'success',
  onStop,
  onClear,
}: AgentResultFooterProps) {
  const t = useTranslations('ide')
  const ToneIcon = TONE_ICON[tone]
  return (
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
      <div className="flex items-center gap-1.5">
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
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
