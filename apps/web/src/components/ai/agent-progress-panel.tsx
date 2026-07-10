'use client'

import * as React from 'react'
import { CheckCircle2, Loader2, AlertCircle, Circle, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ProgressStep {
  id: string
  title: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
  duration?: number
}

interface AgentProgressPanelProps {
  steps: ProgressStep[]
}

const STEP_META: Record<
  ProgressStep['status'],
  { icon: React.ComponentType<{ className?: string }>; cls: string; ring: string }
> = {
  pending: { icon: Circle, cls: 'text-muted-foreground', ring: 'border-muted' },
  running: { icon: Loader2, cls: 'text-blue-500', ring: 'border-blue-500' },
  done: { icon: CheckCircle2, cls: 'text-emerald-500', ring: 'border-emerald-500' },
  error: { icon: AlertCircle, cls: 'text-destructive', ring: 'border-destructive' },
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function AgentProgressPanel({ steps }: AgentProgressPanelProps) {
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
    <div className="rounded-xl border bg-card p-4">
      <ol className="relative space-y-1">
        {steps.map((step, idx) => {
          const meta = STEP_META[step.status]
          const Icon = meta.icon
          const isLast = idx === steps.length - 1
          const isOpen = expanded.has(step.id)
          const hasDetail = Boolean(step.detail)
          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px',
                    step.status === 'done' ? 'bg-emerald-500/40' : 'bg-border',
                  )}
                />
              )}
              <span
                className={cn(
                  'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-card',
                  meta.ring,
                )}
              >
                <Icon className={cn('h-3 w-3', meta.cls, step.status === 'running' && 'animate-spin')} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => hasDetail && toggle(step.id)}
                    className={cn(
                      'flex min-w-0 items-center gap-1 text-left text-sm font-medium',
                      hasDetail && 'cursor-pointer hover:text-primary',
                    )}
                  >
                    <span className="truncate">{step.title}</span>
                    {hasDetail && (
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-180',
                        )}
                      />
                    )}
                  </button>
                  {step.duration !== undefined && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDuration(step.duration)}
                    </span>
                  )}
                </div>
                {hasDetail && isOpen && (
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default AgentProgressPanel
