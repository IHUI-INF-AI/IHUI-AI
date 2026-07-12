'use client'

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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

import { selectClass } from './types'
import type { useNewsArticles } from './useNewsArticles'

type Props = ReturnType<typeof useNewsArticles>

export function NewsArticleDialog(props: Props) {
  const t = useTranslations('admin.news')
  const { open, setOpen, editing, form, setForm, err, closeDialog, submit, saveMut, categories } =
    props

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="art-title">{t('fieldTitle')}</Label>
            <Input
              id="art-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="art-category">{t('fieldCategory')}</Label>
              <Select
                value={form.categoryId || 'none'}
                onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="art-category">
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
              <Label htmlFor="art-author">{t('fieldAuthorName')}</Label>
              <Input
                id="art-author"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                placeholder={t('authorNamePlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="art-summary">{t('fieldSummary')}</Label>
            <Input
              id="art-summary"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder={t('summaryPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="art-cover">{t('fieldCoverImage')}</Label>
            <Input
              id="art-cover"
              value={form.coverImage}
              onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              placeholder={t('coverImagePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="art-content">{t('fieldContent')}</Label>
            <textarea
              id="art-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder={t('contentPlaceholder')}
              className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="art-sort">{t('fieldSort')}</Label>
              <Input
                id="art-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                id="art-published"
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
              />
              <Label htmlFor="art-published">{t('fieldPublished')}</Label>
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                id="art-pinned"
                checked={form.isPinned}
                onCheckedChange={(v) => setForm({ ...form, isPinned: v })}
              />
              <Label htmlFor="art-pinned">{t('fieldPinned')}</Label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="art-status"
              checked={form.status}
              onCheckedChange={(v) => setForm({ ...form, status: v })}
            />
            <Label htmlFor="art-status">{t('fieldStatus')}</Label>
            <span className="text-sm text-muted-foreground">
              {form.status ? t('enabled') : t('disabled')}
            </span>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={saveMut.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
