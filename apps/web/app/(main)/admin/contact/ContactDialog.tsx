'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { FIELDS } from './helpers'
import type { ContactItem } from './types'

interface Props {
  open: boolean
  editing: ContactItem | null
  form: ContactItem
  setForm: React.Dispatch<React.SetStateAction<ContactItem>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ContactDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('adminContact')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{t(f.label)}</Label>
              <RichTextEditor
                value={form[f.key]}
                onChange={(html) => setForm({ ...form, [f.key]: html })}
                placeholder={t('inputPlaceholder', { label: t(f.label) })}
              />
            </div>
          ))}
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
