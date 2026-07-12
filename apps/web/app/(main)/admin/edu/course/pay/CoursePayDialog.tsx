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
} from '@ihui/ui'
import { selectClass } from '@/lib/edu'
import type { CoursePay, CForm } from './types'

interface Props {
  open: boolean
  editing: CoursePay | null
  form: CForm
  setForm: React.Dispatch<React.SetStateAction<CForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function CoursePayDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.course.pay')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
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
            <Label htmlFor="cp-course">{t('courseId')}</Label>
            <Input
              id="cp-course"
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cp-type">{t('payTypeLabel')}</Label>
              <Select value={form.payType} onValueChange={(v) => setForm({ ...form, payType: v })}>
                <SelectTrigger className={selectClass} id="cp-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('payType.0')}</SelectItem>
                  <SelectItem value="1">{t('payType.1')}</SelectItem>
                  <SelectItem value="2">{t('payType.2')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-crowd">{t('payCrowdLabel')}</Label>
              <Select
                value={form.payCrowd}
                onValueChange={(v) => setForm({ ...form, payCrowd: v })}
              >
                <SelectTrigger className={selectClass} id="cp-crowd">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('payCrowd.0')}</SelectItem>
                  <SelectItem value="1">{t('payCrowd.1')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-amount">{t('amount')}</Label>
            <Input
              id="cp-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
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
