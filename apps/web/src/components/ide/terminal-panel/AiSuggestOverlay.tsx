import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import type { TerminalSuggestion } from '@ihui/types'
import { Sparkles, RefreshCw, X } from 'lucide-react'

interface AiSuggestOverlayProps {
  loading: boolean
  error: string | null
  suggestions: TerminalSuggestion[]
  onRefresh: () => void
  onClose: () => void
  onInsert: (command: string) => void
}

/** AI 建议浮层(2026-07-23 立,仅活跃 pane) */
export function AiSuggestOverlay({
  loading,
  error,
  suggestions,
  onRefresh,
  onClose,
  onInsert,
}: AiSuggestOverlayProps) {
  const t = useTranslations('ide')
  return (
    <div className="absolute left-2 top-10 z-20 w-80 overflow-hidden rounded-md border border-border bg-popover shadow-md">
      <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('terminalPanel.aiSuggestTitle')}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip content={t('terminalPanel.refreshSuggest')}>
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              onClick={onRefresh}
              disabled={loading}
              aria-label={t('terminalPanel.refreshSuggest')}
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            </button>
          </Tooltip>
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
      </div>
      <div className="max-h-60 overflow-y-auto">
        {error ? (
          <div className="px-2.5 py-3 text-center text-xs text-destructive">
            {error}
            <div className="mt-1 text-[10px] text-muted-foreground">
              {t('terminalPanel.aiServiceUnavailable')}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-1.5 px-2.5 py-3 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>{t('terminalPanel.generatingSuggest')}</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">
            {t('terminalPanel.noSuggestHint')}
          </div>
        ) : (
          suggestions.map((s, i) => (
            <Tooltip key={`${i}-${s.command}`} content={t('terminalPanel.insertSuggestTitle')}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => onInsert(s.command)}
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate font-mono text-foreground">{s.command}</code>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {Math.round(s.confidence * 100)}%
                  </span>
                </div>
                {s.description && (
                  <span className="text-[10px] text-muted-foreground">{s.description}</span>
                )}
              </button>
            </Tooltip>
          ))
        )}
      </div>
    </div>
  )
}
