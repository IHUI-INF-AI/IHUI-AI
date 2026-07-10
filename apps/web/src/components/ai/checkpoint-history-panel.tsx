'use client'

import * as React from 'react'
import { History, ChevronDown, RotateCcw } from 'lucide-react'

import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Checkpoint {
  id: string
  label: string
  timestamp: string
  diff?: string
}

interface CheckpointHistoryPanelProps {
  checkpoints: Checkpoint[]
  onRestore?: (id: string) => void
}

export function CheckpointHistoryPanel({
  checkpoints,
  onRestore,
}: CheckpointHistoryPanelProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

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
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">检查点历史</h3>
      </div>
      <div className="p-3">
        {checkpoints.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无检查点</p>
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
                  <span className="z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary bg-card" />
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
                        <span className="truncate">{cp.label}</span>
                        {hasDiff && (
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                              isOpen && 'rotate-180',
                            )}
                          />
                        )}
                      </button>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {cp.timestamp}
                      </span>
                    </div>
                    {hasDiff && isOpen && (
                      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        <code>{cp.diff}</code>
                      </pre>
                    )}
                    {onRestore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => onRestore(cp.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        恢复
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

export default CheckpointHistoryPanel
