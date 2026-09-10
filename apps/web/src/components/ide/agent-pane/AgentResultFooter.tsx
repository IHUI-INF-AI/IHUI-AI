// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:底部结果 + 控制区从 agent-pane.tsx 抽出
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { Trash2, AlertCircle, CheckCircle2, Square } from 'lucide-react'

export interface AgentResultFooterProps {
  error: string | null
  result: string
  isRunning: boolean
  taskId: string | null
  onStop: () => void
  onClear: () => void
}

export function AgentResultFooter({
  error,
  result,
  isRunning,
  taskId,
  onStop,
  onClear,
}: AgentResultFooterProps) {
  const t = useTranslations('ide')
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
        >
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden />
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
