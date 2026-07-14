'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { selectClass, textareaClass } from '@/lib/edu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { useTranslations } from 'next-intl'
import type { Homework, HForm } from './types'

interface Props {
  open: boolean
  editing: Homework | null
  form: HForm
  onFormChange: (patch: Partial<HForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function HomeworkDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.learn.homework')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="h-title">{t('fieldTitle')}</Label>
            <Input
              id="h-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-desc">{t('fieldDescription')}</Label>
            <textarea
              id="h-desc"
              className={textareaClass}
              rows={4}
              value={form.description}
              onChange={(e) => onFormChange({ description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="h-due">{t('fieldDueDate')}</Label>
              <Input
                id="h-due"
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => onFormChange({ dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-status">{t('fieldStatus')}</Label>
              <Select value={form.status} onValueChange={(v) => onFormChange({ status: v })}>
                <SelectTrigger className={selectClass} id="h-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('statusActive')}</SelectItem>
                  <SelectItem value="closed">{t('statusClosed')}</SelectItem>
                  <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
