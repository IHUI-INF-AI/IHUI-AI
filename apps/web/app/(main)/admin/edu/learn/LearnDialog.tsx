'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
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
  Switch,
} from '@ihui/ui'
import { selectClass } from '@/lib/edu'
import { ImageUpload } from '@/components/form/ImageUpload'
import dynamic from 'next/dynamic'
import type { Category, LForm, Lesson } from './types'

// 动态导入 tiptap 富文本编辑器(~500KB,9 个扩展),仅 admin 页按需加载
const TiptapRichText = dynamic(
  () => import('@/components/form/TiptapRichText').then((m) => m.TiptapRichText),
  { ssr: false, loading: () => <div className="min-h-[200px] rounded-lg border" /> },
)

function splitIds(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

interface Props {
  open: boolean
  editing: Lesson | null
  form: LForm
  setForm: React.Dispatch<React.SetStateAction<LForm>>
  err: string | null
  savePending: boolean
  categories: Category[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function LearnDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  categories,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.learn.index')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-xl">
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
            <Label htmlFor="l-title">{t('labelTitle')}</Label>
            <Input
              id="l-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="l-cat">{t('labelCategory')}</Label>
              <Select
                value={form.categoryId || 'none'}
                onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="l-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noCategory')}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-lec">{t('labelLecturer')}</Label>
              <Input
                id="l-lec"
                value={form.lecturerName}
                onChange={(e) => setForm({ ...form, lecturerName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-intro">{t('labelIntro')}</Label>
            <Input
              id="l-intro"
              value={form.intro}
              onChange={(e) => setForm({ ...form, intro: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-intro-rt">{t('labelIntroduction')}</Label>
            <TiptapRichText
              value={form.introduction}
              onChange={(v) => setForm({ ...form, introduction: v })}
              placeholder={t('introductionPlaceholder')}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-image">{t('labelImage')}</Label>
            <ImageUpload
              value={form.image || undefined}
              onChange={(v) =>
                setForm({ ...form, image: typeof v === 'string' ? v : (v[0] ?? '') })
              }
              placeholder={t('imageUploadPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-cid">{t('labelCidList')}</Label>
            <Input
              id="l-cid"
              value={form.cidList.join(',')}
              onChange={(e) => setForm({ ...form, cidList: splitIds(e.target.value) })}
              placeholder={t('cidListPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="l-price">{t('labelPrice')}</Label>
              <Input
                id="l-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-sort">{t('labelSort')}</Label>
              <Input
                id="l-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="l-free"
                checked={form.isFree}
                onCheckedChange={(v) => setForm({ ...form, isFree: v })}
              />
              <Label htmlFor="l-free">{t('labelFree')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="l-pub"
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
              />
              <Label htmlFor="l-pub">{t('labelPublish')}</Label>
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
