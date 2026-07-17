'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface AgentPillProps {
  name: string
  status: 'idle' | 'running' | 'done' | 'error'
  onClick?: () => void
  active?: boolean
}

const STATUS_DOT: Record<AgentPillProps['status'], string> = {
  idle: 'bg-muted-foreground',
  running: 'bg-amber-500 animate-pulse',
  done: 'bg-green-500',
  error: 'bg-red-500',
}

export function AgentPill({ name, status, onClick, active }: AgentPillProps) {
  const interactive = !!onClick

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-foreground',
        interactive && 'cursor-pointer hover:bg-accent',
        !interactive && 'cursor-default',
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[status])} />
      <span className="break-words max-w-[12rem]">{name}</span>
    </button>
  )
}

export default AgentPill
