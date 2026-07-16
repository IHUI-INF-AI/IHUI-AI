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
  Switch,
} from '@ihui/ui'
import { selectClass, textareaClass } from '@/lib/edu'
import { ImageUpload } from '@/components/form/ImageUpload'
import type { TForm, Topic } from './types'

function splitIds(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

interface Props {
  open: boolean
  editing: Topic | null
  form: TForm
  setForm: React.Dispatch<React.SetStateAction<TForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function TopicsDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.learn.topics')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
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
            <Label htmlFor="t-title">{t('fieldTitle')}</Label>
            <Input
              id="t-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-slug">{t('fieldSlug')}</Label>
              <Input
                id="t-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-sort">{t('fieldSort')}</Label>
              <Input
                id="t-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-image">{t('fieldImage')}</Label>
            <ImageUpload
              value={form.image || undefined}
              onChange={(v) =>
                setForm({ ...form, image: typeof v === 'string' ? v : (v[0] ?? '') })
              }
              placeholder={t('imageUploadPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-cid">{t('fieldCidList')}</Label>
            <Input
              id="t-cid"
              value={form.cidList.join(',')}
              onChange={(e) => setForm({ ...form, cidList: splitIds(e.target.value) })}
              placeholder={t('cidListPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-lid">{t('fieldLidList')}</Label>
            <Input
              id="t-lid"
              value={form.lidList.join(',')}
              onChange={(e) => setForm({ ...form, lidList: splitIds(e.target.value) })}
              placeholder={t('lidListPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">{t('fieldDescription')}</Label>
            <textarea
              id="t-desc"
              className={textareaClass}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-price">{t('fieldPrice')}</Label>
              <Input
                id="t-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-oprice">{t('fieldOriginalPrice')}</Label>
              <Input
                id="t-oprice"
                type="number"
                min="0"
                step="0.01"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-status">{t('fieldStatus')}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className={selectClass} id="t-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                <SelectItem value="published">{t('statusPublished')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="t-show-index"
              checked={form.isShowIndex}
              onCheckedChange={(v) => setForm({ ...form, isShowIndex: v })}
            />
            <Label htmlFor="t-show-index">{t('fieldShowIndex')}</Label>
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
