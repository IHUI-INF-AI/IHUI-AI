'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { ImageUpload } from '@/components/form/ImageUpload'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { selectClass } from '@/lib/edu'
import { TEXT_FIELDS } from './helpers'
import type { CForm, Video } from './types'

interface Props {
  open: boolean
  editing: Video | null
  form: CForm
  setForm: React.Dispatch<React.SetStateAction<CForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function RecordedDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.learn.recorded')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            {TEXT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{t(f.label)}</Label>
                <Input
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t('fieldPay')}</Label>
              <Select value={form.isPay} onValueChange={(v) => setForm({ ...form, isPay: v })}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('payFree')}</SelectItem>
                  <SelectItem value="1">{t('payPaid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('fieldStatus')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('level.0')}</SelectItem>
                  <SelectItem value="1">{t('level.1')}</SelectItem>
                  <SelectItem value="2">{t('level.2')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('fieldAudit')}</Label>
              <Select
                value={form.auditStatus}
                onValueChange={(v) => setForm({ ...form, auditStatus: v })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('audit.0')}</SelectItem>
                  <SelectItem value="1">{t('audit.1')}</SelectItem>
                  <SelectItem value="2">{t('audit.2')}</SelectItem>
                  <SelectItem value="3">{t('audit.3')}</SelectItem>
                  <SelectItem value="4">{t('audit.4')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('fieldCover')}</Label>
            <ImageUpload
              value={form.binding}
              onChange={(v) => setForm({ ...form, binding: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldContent')}</Label>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
              placeholder={t('contentPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldRemark')}</Label>
            <RichTextEditor
              value={form.remark}
              onChange={(html) => setForm({ ...form, remark: html })}
              placeholder={t('remarkPlaceholder')}
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
