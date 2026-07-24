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
import type { Schedule, SForm } from './types'

interface Props {
  open: boolean
  editing: Schedule | null
  form: SForm
  onFormChange: (patch: Partial<SForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function ScheduleDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.eduClassSchedule')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('dialogEditTitle') : t('dialogCreateTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="sc-class">{t('fieldClassId')}</Label>
            <Input
              id="sc-class"
              value={form.classId}
              onChange={(e) => onFormChange({ classId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sc-title">{t('fieldTitle')}</Label>
            <Input
              id="sc-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sc-start">{t('fieldStartTime')}</Label>
              <Input
                id="sc-start"
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => onFormChange({ startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-end">{t('fieldEndTime')}</Label>
              <Input
                id="sc-end"
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => onFormChange({ endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sc-teacher">{t('fieldTeacher')}</Label>
              <Input
                id="sc-teacher"
                value={form.teacherName}
                onChange={(e) => onFormChange({ teacherName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-loc">{t('fieldLocation')}</Label>
              <Input
                id="sc-loc"
                value={form.location}
                onChange={(e) => onFormChange({ location: e.target.value })}
              />
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
