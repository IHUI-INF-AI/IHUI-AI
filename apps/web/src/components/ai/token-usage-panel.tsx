'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TokenUsagePanelProps {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost?: number
  model?: string
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function TokenUsagePanel({
  promptTokens,
  completionTokens,
  totalTokens,
  cost,
  model,
}: TokenUsagePanelProps) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground">
      <div className="grid grid-cols-3 gap-3">
        <StatItem label="Prompt" value={promptTokens} />
        <StatItem label="Completion" value={completionTokens} />
        <StatItem label="Total" value={totalTokens} />
      </div>
      {(cost !== undefined || model) && (
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          {model && <span className="break-words">{model}</span>}
          {cost !== undefined && (
            <span className={cn('tabular-nums', cost > 0 && 'text-foreground font-medium')}>
              ${cost.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default TokenUsagePanel
