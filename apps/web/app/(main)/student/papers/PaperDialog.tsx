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

import type { PaperForm } from './types'

interface Props {
  open: boolean
  form: PaperForm
  setForm: React.Dispatch<React.SetStateAction<PaperForm>>
  err: string | null
  createPending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function PaperDialog({ open, form, setForm, err, createPending, onSubmit, onClose }: Props) {
  const t = useTranslations('papers')

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
            <DialogTitle>{t('upload')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="p-title">{t('paperTitleField')}</Label>
            <Input
              id="p-title"
              value={form.paperTitle}
              onChange={(e) => setForm({ ...form, paperTitle: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-url">{t('paperUrlField')}</Label>
            <Input
              id="p-url"
              value={form.paperUrl}
              onChange={(e) => setForm({ ...form, paperUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={createPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createPending}>
              {createPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('upload')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
