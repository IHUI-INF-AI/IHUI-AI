'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import type { Chapter, ChForm } from './types'

interface Props {
  open: boolean
  editing: Chapter | null
  form: ChForm
  onFormChange: (patch: Partial<ChForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function ChapterDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.course.chapters')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editChapter') : t('createChapter')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ch-title">{t('titleLabel')}</Label>
            <Input
              id="ch-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-sort">{t('sortOrderLabel')}</Label>
            <Input
              id="ch-sort"
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={(e) => onFormChange({ sortOrder: e.target.value })}
            />
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
