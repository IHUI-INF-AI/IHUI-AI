'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { selectClass } from '@/lib/edu'
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
import { useTranslations } from 'next-intl'
import type { Live, LForm } from './types'

interface Props {
  open: boolean
  editing: Live | null
  form: LForm
  onFormChange: (patch: Partial<LForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function LiveDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.learn.live')
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
            <Label htmlFor="v-title">{t('fieldTitle')}</Label>
            <Input
              id="v-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="v-lec">{t('fieldLecturer')}</Label>
              <Input
                id="v-lec"
                value={form.lecturerName}
                onChange={(e) => onFormChange({ lecturerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-time">{t('fieldStartTime')}</Label>
              <Input
                id="v-time"
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => onFormChange({ startTime: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="v-status">{t('fieldStatus')}</Label>
            <Select value={form.status} onValueChange={(v) => onFormChange({ status: v })}>
              <SelectTrigger className={selectClass} id="v-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">{t('statusUpcoming')}</SelectItem>
                <SelectItem value="ongoing">{t('statusOngoing')}</SelectItem>
                <SelectItem value="ended">{t('statusEnded')}</SelectItem>
              </SelectContent>
            </Select>
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
