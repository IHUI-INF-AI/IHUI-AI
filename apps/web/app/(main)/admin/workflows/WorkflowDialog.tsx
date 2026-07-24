'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { TRIGGER_OPTIONS, selectClass, textareaClass } from './helpers'
import type { WorkflowForm, WorkflowItem, TriggerType } from './types'

interface WorkflowDialogProps {
  open: boolean
  editing: WorkflowItem | null
  form: WorkflowForm
  err: string | null
  isPending: boolean
  onFormChange: (form: WorkflowForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function WorkflowDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: WorkflowDialogProps) {
  const t = useTranslations('admin.workflows')
  const tc = useTranslations('common')

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wf-name">{t('name')}</Label>
            <Input
              id="wf-name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
              maxLength={128}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-desc">{t('description')}</Label>
            <Input
              id="wf-desc"
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              placeholder={t('descPlaceholder')}
              maxLength={2000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-trigger">{t('triggerType')}</Label>
            <Select
              value={form.triggerType}
              onValueChange={(v) => onFormChange({ ...form, triggerType: v as TriggerType })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((tt) => (
                  <SelectItem key={tt} value={tt}>
                    {t(`trigger_${tt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-steps">{t('steps')}</Label>
            <textarea
              id="wf-steps"
              className={cn(textareaClass, 'min-h-[100px] font-mono')}
              value={form.stepsText}
              onChange={(e) => onFormChange({ ...form, stepsText: e.target.value })}
              placeholder={t('stepsPlaceholder')}
              rows={4}
            />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {editing ? tc('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
