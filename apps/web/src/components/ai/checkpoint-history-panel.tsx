// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { History, ChevronDown, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import type { CheckpointScope } from '@/api/checkpoint-api'
import { CheckpointRollbackConfirm } from '@/components/ai/checkpoint-rollback-confirm'

interface Checkpoint {
  id: string
  label: string
  timestamp: string
  diff?: string
}

interface CheckpointHistoryPanelProps {
  checkpoints: Checkpoint[]
  sessionId: string
  onRestore?: (id: string, scope: CheckpointScope) => void
}

export function CheckpointHistoryPanel({
  checkpoints,
  sessionId,
  onRestore,
}: CheckpointHistoryPanelProps) {
  const t = useTranslations('ai.checkpointHistory')
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [scope, setScope] = React.useState<CheckpointScope>('both')
  const [confirmTarget, setConfirmTarget] = React.useState<{
    id: string
    scope: CheckpointScope
  } | null>(null)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{t('title')}</h3>
      </div>
      {onRestore && checkpoints.length > 0 && (
        <div
          className="flex items-center gap-2 border-b px-4 py-2"
          data-testid="checkpoint-scope-selector"
        >
          <span className="text-xs text-muted-foreground">{t('scopeLabel')}</span>
          <div className="flex overflow-hidden rounded-md border" role="group">
            {(
              [
                ['conversation', t('scopeConversation')],
                ['code', t('scopeCode')],
                ['both', t('scopeBoth')],
              ] as Array<[CheckpointScope, string]>
            ).map(([s, label]) => (
              <button
                key={s}
                type="button"
                data-testid={`checkpoint-scope-${s}`}
                onClick={() => setScope(s)}
                className={cn(
                  'px-2 py-0.5 text-xs transition-colors',
                  scope === s
                    ? 'bg-cta text-cta-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="p-3">
        {checkpoints.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ol className="relative space-y-2">
            {checkpoints.map((cp, idx) => {
              const isLast = idx === checkpoints.length - 1
              const isOpen = expanded.has(cp.id)
              const hasDiff = Boolean(cp.diff)
              return (
                <li key={cp.id} className="relative flex gap-3">
                  {!isLast && (
                    <span className="absolute left-[7px] top-7 h-[calc(100%-0.5rem)] w-px bg-border" />
                  )}
                  <span className="z-10 mt-0.5 h-3.5 w-3.5 shrink-0 rounded-md border-2 border-brand-accent-deep bg-card" />
                  <div className="min-w-0 flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => hasDiff && toggle(cp.id)}
                        className={cn(
                          'flex min-w-0 items-center gap-1 text-left text-sm font-medium',
                          hasDiff && 'cursor-pointer hover:text-primary',
                        )}
                      >
                        <span className="break-words">{cp.label}</span>
                        {hasDiff && (
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                              isOpen && 'rotate-180',
                            )}
                          />
                        )}
                      </button>
                      <span className="shrink-0 text-xs text-muted-foreground">{cp.timestamp}</span>
                    </div>
                    {hasDiff && isOpen && (
                      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        <code>{cp.diff}</code>
                      </pre>
                    )}
                    {onRestore && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="mt-1 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => setConfirmTarget({ id: cp.id, scope })}
                        data-testid={`checkpoint-restore-${cp.id}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t('restore')}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <CheckpointRollbackConfirm
        open={confirmTarget !== null}
        checkpointId={confirmTarget?.id ?? ''}
        sessionId={sessionId}
        scope={confirmTarget?.scope ?? 'both'}
        checkpointLabel={
          confirmTarget ? (checkpoints.find((c) => c.id === confirmTarget.id)?.label ?? '') : ''
        }
        onConfirm={() => {
          if (!confirmTarget) return
          const target = confirmTarget
          setConfirmTarget(null)
          onRestore?.(target.id, target.scope)
        }}
        onClose={() => setConfirmTarget(null)}
      />
    </div>
  )
}

export default CheckpointHistoryPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
