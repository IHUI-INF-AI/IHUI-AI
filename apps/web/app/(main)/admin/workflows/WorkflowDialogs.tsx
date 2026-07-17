'use client'

import * as React from 'react'
import { Loader2, Workflow, Zap } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@ihui/ui'
import { STATUS_BADGE, stepName } from './helpers'
import type { WorkflowItem } from './types'

interface WorkflowViewDialogProps {
  item: WorkflowItem | null
  onClose: () => void
}

export function WorkflowViewDialog({ item, onClose }: WorkflowViewDialogProps) {
  const t = useTranslations('admin.workflows')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('viewTitle')}</DialogTitle>
        </DialogHeader>
        {item ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Workflow className="h-4 w-4" />
              </div>
              <span className="font-medium">{item.name}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                  (STATUS_BADGE[item.isActive ? 'active' : 'archived'] ?? STATUS_BADGE.draft).cls,
                )}
              >
                {t(`status_${item.isActive ? 'active' : 'archived'}`)}
              </span>
            </div>
            {item.description ? <p className="text-muted-foreground">{item.description}</p> : null}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              {t(`trigger_${item.triggerType}`)}
              <span className="mx-1">·</span>
              {dateFmt.format(new Date(item.createdAt))}
            </div>
            {Array.isArray(item.steps) && item.steps.length > 0 ? (
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  {t('steps')}
                </div>
                <ol className="ml-4 list-decimal space-y-1">
                  {item.steps.map((s, i) => (
                    <li key={`step-${i}`} className="text-sm">
                      {stepName(s)}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {tc('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface WorkflowDeleteDialogProps {
  delId: string | null
  isPending: boolean
  onClose: () => void
  onConfirm: () => void
}

export function WorkflowDeleteDialog({
  delId,
  isPending,
  onClose,
  onConfirm,
}: WorkflowDeleteDialogProps) {
  const t = useTranslations('admin.workflows')
  const tc = useTranslations('common')

  return (
    <Dialog
      open={delId !== null}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {tc('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {tc('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
