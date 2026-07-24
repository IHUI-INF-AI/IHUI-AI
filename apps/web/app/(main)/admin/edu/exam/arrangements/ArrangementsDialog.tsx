'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
} from '@ihui/ui-react'
import { selectClass } from '@/lib/edu'
import type { AForm, Arrangement, Paper } from './types'

interface Props {
  open: boolean
  editing: Arrangement | null
  form: AForm
  setForm: React.Dispatch<React.SetStateAction<AForm>>
  err: string | null
  savePending: boolean
  papers: Paper[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ArrangementsDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  papers,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.exam.arrangements')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
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
            <Label htmlFor="a-paper">{t('fieldPaper')}</Label>
            <Select value={form.paperId} onValueChange={(v) => setForm({ ...form, paperId: v })}>
              <SelectTrigger className={selectClass} id="a-paper">
                <SelectValue placeholder={t('selectPaperPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {papers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="a-start">{t('fieldStartTime')}</Label>
              <Input
                id="a-start"
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-end">{t('fieldEndTime')}</Label>
              <Input
                id="a-end"
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="a-room">{t('fieldRoom')}</Label>
              <Input
                id="a-room"
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                placeholder={t('roomPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-inv">{t('fieldInvigilator')}</Label>
              <Input
                id="a-inv"
                value={form.invigilator}
                onChange={(e) => setForm({ ...form, invigilator: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-status">{t('fieldStatus')}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className={selectClass} id="a-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">{t('statusScheduled')}</SelectItem>
                <SelectItem value="ongoing">{t('statusOngoing')}</SelectItem>
                <SelectItem value="finished">{t('statusFinished')}</SelectItem>
                <SelectItem value="cancelled">{t('statusCancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
