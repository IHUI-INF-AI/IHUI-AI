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
} from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'
import type { PlatformLog, CForm } from './types'

interface Props {
  open: boolean
  editing: PlatformLog | null
  form: CForm
  setForm: React.Dispatch<React.SetStateAction<CForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function PlatformLogDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.course.platformLog')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('platformId')}</Label>
              <Input
                value={form.platformId}
                onChange={(e) => setForm({ ...form, platformId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('courseId')}</Label>
              <Input
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('videoId')}</Label>
              <Input
                value={form.videoId}
                onChange={(e) => setForm({ ...form, videoId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('typeLabel')}</Label>
              <Input
                type="number"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('creator')}</Label>
              <Input
                value={form.creator}
                onChange={(e) => setForm({ ...form, creator: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('sysCreator')}</Label>
              <Input
                value={form.sysCreator}
                onChange={(e) => setForm({ ...form, sysCreator: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('createdAt')}</Label>
            <DatePicker
              value={form.createdAt}
              onChange={(v) => setForm({ ...form, createdAt: v })}
            />
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
