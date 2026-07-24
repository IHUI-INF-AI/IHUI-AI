'use client'

import { Trash2, Pencil } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {
  formatMemoryTime,
  getMemoryTypeOption,
  getMemoryScopeOption,
} from '@/lib/memory-api'
import type { MemoryEntry } from '@ihui/types'

interface MemoryCardProps {
  entry: MemoryEntry
  onDelete?: (id: string) => void
  onEdit?: (entry: MemoryEntry) => void
  deleting?: boolean
}

export function MemoryCard({ entry, onDelete, onEdit, deleting }: MemoryCardProps) {
  const typeOpt = getMemoryTypeOption(entry.type)
  const scopeOpt = getMemoryScopeOption(entry.scope)

  return (
    <div className="group flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20 hover:bg-accent/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold leading-tight text-foreground">
            {entry.category}
          </span>
          <span
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
              typeOpt?.color ?? 'bg-muted text-muted-foreground',
            )}
          >
            {typeOpt?.label ?? entry.type}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(entry)}
              disabled={deleting}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(entry.id)}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {entry.text}
      </p>

      <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted-foreground/70">
        <span>
          {scopeOpt?.label ?? entry.scope} · {entry.source}
        </span>
        <span>{formatMemoryTime(entry.updatedAt)}</span>
      </div>
    </div>
  )
}
