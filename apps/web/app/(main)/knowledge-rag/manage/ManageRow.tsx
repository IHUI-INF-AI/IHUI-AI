'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'

import { Card, CardContent, Checkbox, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface DocSummary {
  id: number
  title: string
  sourceType: string
  chunkCount: number
  createdAt: string | null
}

interface ManageRowProps {
  doc: DocSummary
  checked: boolean
  srcLabel: string
  fmtDate: string
  chunkLabel: string
  deleteLabel: string
  disabled: boolean
  onToggle: () => void
  onDelete: () => void
}

export function ManageRow({
  doc,
  checked,
  srcLabel,
  fmtDate,
  chunkLabel,
  deleteLabel,
  disabled,
  onToggle,
  onDelete,
}: ManageRowProps) {
  return (
    <Card className={cn(checked && 'border-primary/50 bg-primary/5')}>
      <CardContent className="flex items-center gap-3 p-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={deleteLabel}
        />
        <Link href={`/knowledge-rag/${doc.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="line-clamp-1 text-sm font-medium">{doc.title}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {srcLabel}
            </span>
            <span className="text-xs text-muted-foreground">{chunkLabel}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{fmtDate}</div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onDelete}
          aria-label={deleteLabel}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
