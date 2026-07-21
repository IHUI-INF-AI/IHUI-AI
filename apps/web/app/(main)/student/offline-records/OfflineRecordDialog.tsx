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
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { AttachmentsUpload } from '@/components/form/AttachmentsUpload'
import type { OfflineRecord, RecordForm } from './types'

interface Props {
  open: boolean
  editing: OfflineRecord | null
  form: RecordForm
  setForm: React.Dispatch<React.SetStateAction<RecordForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function OfflineRecordDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('offlineRecords')
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
            <DialogTitle>{editing ? t('edit') : t('create')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="r-type">{t('type')}</Label>
            <Input
              id="r-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder={t('typePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-title">{t('titleField')}</Label>
            <Input
              id="r-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-desc">{t('descriptionField')}</Label>
            <textarea
              id="r-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="r-hours">{t('hoursField')}</Label>
              <Input
                id="r-hours"
                type="number"
                min="0"
                step="0.5"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-date">{t('occurredAtField')}</Label>
              <Input
                id="r-date"
                type="date"
                value={form.occurredAt}
                onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('attachmentsField')}</Label>
            <AttachmentsUpload
              value={form.attachments}
              onChange={(items) => setForm({ ...form, attachments: items })}
              multiple
              maxCount={10}
              accept="image/*,audio/*,video/*,application/pdf"
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
