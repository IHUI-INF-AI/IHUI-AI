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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { selectClass, HELP_CATEGORIES } from './helpers'
import { slugify } from '@/lib/content'
import type { HelpArticle, HelpForm } from './types'

interface Props {
  open: boolean
  editing: HelpArticle | null
  form: HelpForm
  setForm: React.Dispatch<React.SetStateAction<HelpForm>>
  slugTouched: boolean
  setSlugTouched: (v: boolean) => void
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function HelpDialog({
  open,
  editing,
  form,
  setForm,
  slugTouched,
  setSlugTouched,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.help')
  const tc = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
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
            <Label htmlFor="h-title">{t('fieldTitle')}</Label>
            <Input
              id="h-title"
              value={form.title}
              onChange={(e) => {
                const title = e.target.value
                setForm({ ...form, title, slug: slugTouched ? form.slug : slugify(title) })
              }}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="h-slug">{t('fieldSlug')}</Label>
              <Input
                id="h-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setForm({ ...form, slug: e.target.value })
                }}
                placeholder={t('slugPlaceholder')}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-category">{t('fieldCategory')}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as HelpForm['category'] })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HELP_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-content">{t('fieldContent')}</Label>
            <textarea
              id="h-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder={t('contentPlaceholder')}
              rows={6}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            {t('fieldPublished')}
          </label>
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
