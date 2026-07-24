'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
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
import { selectClass } from './helpers'
import type { Announcement, AnnouncementForm, AnnType } from './types'

interface Props {
  open: boolean
  editing: Announcement | null
  form: AnnouncementForm
  setForm: React.Dispatch<React.SetStateAction<AnnouncementForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AnnouncementDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.announcements')
  const tc = useTranslations('common')
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
            <DialogDescription>{t('createDesc')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="a-title">{t('fieldTitle')}</Label>
            <Input
              id="a-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-content">{t('fieldContent')}</Label>
            <textarea
              id="a-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder={t('contentPlaceholder')}
              rows={5}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="a-type">{t('fieldType')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as AnnType })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">{t('types.info')}</SelectItem>
                  <SelectItem value="warning">{t('types.warning')}</SelectItem>
                  <SelectItem value="maintenance">{t('types.maintenance')}</SelectItem>
                  <SelectItem value="update">{t('types.update')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t('fieldPinned')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t('fieldPublished')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
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
