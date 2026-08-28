import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import type { TerminalDiagnoseResponse } from '@ihui/types'
import { Stethoscope, RefreshCw, X, Wand2 } from 'lucide-react'

interface AiDiagnoseOverlayProps {
  loading: boolean
  error: string | null
  result: TerminalDiagnoseResponse | null
  onClose: () => void
  onAutoFix: () => void
}

/** AI 诊断浮层(2026-07-23 立,失败自动弹出,仅活跃 pane) */
export function AiDiagnoseOverlay({
  loading,
  error,
  result,
  onClose,
  onAutoFix,
}: AiDiagnoseOverlayProps) {
  const t = useTranslations('ide')
  return (
    <div className="absolute right-2 top-10 z-20 w-96 overflow-hidden rounded-md border border-border bg-popover shadow-md">
      <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Stethoscope className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('terminalPanel.aiDiagnoseTitle')}
          </span>
        </div>
        <Tooltip content={t('terminalPanel.close')}>
          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={onClose}
            aria-label={t('terminalPanel.close')}
          >
            <X className="h-3 w-3" />
          </button>
        </Tooltip>
      </div>
      <div className="max-h-72 overflow-y-auto px-2.5 py-2 text-xs">
        {error ? (
          <div className="text-center text-destructive">
            {error}
            <div className="mt-1 text-[10px] text-muted-foreground">
              {t('terminalPanel.aiServiceUnavailable')}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>{t('terminalPanel.diagnosing')}</span>
          </div>
        ) : result ? (
          <div className="flex flex-col gap-1.5">
            <div>
              <span className="font-medium text-foreground">
                {t('terminalPanel.diagnosisLabel')}
              </span>
              <span className="text-muted-foreground"> {result.diagnosis}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">
                {t('terminalPanel.rootCauseLabel')}
              </span>
              <span className="text-muted-foreground"> {result.rootCause}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">
                {t('terminalPanel.suggestedFixLabel')}
              </span>
              <span className="text-muted-foreground"> {result.suggestedFix}</span>
            </div>
            {result.fixCommand && (
              <div className="mt-1 flex items-center gap-2 rounded bg-muted/50 p-1.5">
                <code className="flex-1 truncate font-mono text-[11px] text-foreground">
                  {result.fixCommand}
                </code>
                <Tooltip content={t('terminalPanel.autoFixTitle')}>
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground transition-colors hover:bg-accent/80"
                    onClick={onAutoFix}
                  >
                    <Wand2 className="h-2.5 w-2.5" />
                    <span>{t('terminalPanel.autoFix')}</span>
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground">{t('terminalPanel.noDiagnosis')}</div>
        )}
      </div>
    </div>
  )
}
