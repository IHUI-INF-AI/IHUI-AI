'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from '@ihui/ui-react'
import { computeDiff } from './helpers'
import type { SkillVersion, DiffLine } from './types'

interface VersionDiffDialogProps {
  open: boolean
  onClose: () => void
  oldVersion: SkillVersion | null
  newVersion: SkillVersion | null
}

export function VersionDiffDialog({ open, onClose, oldVersion, newVersion }: VersionDiffDialogProps) {
  const diffLines = React.useMemo<DiffLine[]>(() => {
    if (!oldVersion || !newVersion) return []
    return computeDiff(oldVersion.content ?? '', newVersion.content ?? '')
  }, [oldVersion, newVersion])

  if (!oldVersion || !newVersion) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            版本对比: {oldVersion.name}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex items-center gap-4 border-b pb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400/70" />
            <span>旧版: {oldVersion.version}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500/70" />
            <span>新版: {newVersion.version}</span>
          </div>
        </div>

        <div className="max-h-96 overflow-auto rounded-md border text-xs font-mono">
          {diffLines.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">两个版本内容相同</div>
          )}
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={`flex px-3 py-0.5 leading-6 ${
                line.type === 'added'
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                  : line.type === 'removed'
                    ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                    : ''
              }`}
            >
              <span className="mr-3 w-8 shrink-0 text-right text-muted-foreground/50 select-none">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="whitespace-pre-wrap break-all">{line.text}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}