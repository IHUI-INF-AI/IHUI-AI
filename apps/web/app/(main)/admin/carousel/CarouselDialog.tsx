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
  Switch,
} from '@ihui/ui'
import { ImageUpload } from '@/components/form/ImageUpload'
import type { Carousel, CarouselForm } from './types'

interface Props {
  open: boolean
  editing: Carousel | null
  form: CarouselForm
  setForm: React.Dispatch<React.SetStateAction<CarouselForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function CarouselDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.carousel')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
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
            <Label>{t('colTitle')}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('colImage')}</Label>
            <ImageUpload
              value={form.imageUrl}
              onChange={(v) => setForm({ ...form, imageUrl: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('colLink')}</Label>
            <Input
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder={t('linkPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>{t('colSort')}</Label>
              <Input
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>{t('enabled')}</Label>
            </div>
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
