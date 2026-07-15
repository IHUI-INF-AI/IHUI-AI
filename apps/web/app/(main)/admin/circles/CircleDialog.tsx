'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  Switch,
} from '@ihui/ui'
import { textareaClass } from './helpers'
import type { Circle, CircleForm } from './types'

interface Props {
  open: boolean
  editing: Circle | null
  form: CircleForm
  setForm: React.Dispatch<React.SetStateAction<CircleForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function CircleDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.circles')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-name">{t('fieldName')}</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-slug">{t('fieldSlug')}</Label>
              <Input
                id="c-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder={t('slugPlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">{t('fieldDescription')}</Label>
            <textarea
              id="c-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-cover">{t('fieldCover')}</Label>
            <Input
              id="c-cover"
              value={form.coverImage}
              onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              placeholder={t('coverPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="c-published"
              checked={form.isPublished}
              onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
            />
            <Label htmlFor="c-published">{t('fieldPublished')}</Label>
            <span className="text-sm text-muted-foreground">
              {form.isPublished ? t('published') : t('draft')}
            </span>
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
