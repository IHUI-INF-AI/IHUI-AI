'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { useTranslations } from 'next-intl'
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
import {
  type Resource,
  type Category,
  type ResourceForm,
  EMPTY_FORM,
  selectClass,
  api,
} from './types'

export function ResourceFormDialog({
  open,
  editing,
  categories,
  onClose,
  t,
}: {
  open: boolean
  editing: Resource | null
  categories: Category[]
  onClose: () => void
  t: ReturnType<typeof useTranslations<'admin.resources'>>
}) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState<ResourceForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title,
          categoryId: editing.categoryId ?? '',
          intro: editing.intro ?? '',
          coverImage: editing.coverImage ?? '',
          fileUrl: editing.fileUrl ?? '',
          fileType: editing.fileType ?? '',
          fileSize: String(editing.fileSize ?? 0),
          isPublished: editing.isPublished,
          sort: String(editing.sort),
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setErr(null)
    }
  }, [open, editing])

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        categoryId: form.categoryId || null,
        intro: form.intro.trim() || null,
        coverImage: form.coverImage.trim() || null,
        fileUrl: form.fileUrl.trim() || null,
        fileType: form.fileType.trim() || null,
        fileSize: Number(form.fileSize) || 0,
        isPublished: form.isPublished,
        sort: Number(form.sort) || 0,
      }
      if (editing) {
        return api<{ resource: Resource }>(`/api/admin/resources/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ resource: Resource }>(`/api/admin/resources`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onClose()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function closeDialog() {
    if (saveMut.isPending) return
    onClose()
    setErr(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    saveMut.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? closeDialog() : null)}>
      <DialogContent className="max-w-xl">
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
            <Label htmlFor="res-title">{t('fieldTitle')}</Label>
            <Input
              id="res-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="res-category">{t('fieldCategory')}</Label>
              <Select
                value={form.categoryId || 'none'}
                onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="res-category">
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
              <Label htmlFor="res-sort">{t('fieldSort')}</Label>
              <Input
                id="res-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-intro">{t('fieldIntro')}</Label>
            <Input
              id="res-intro"
              value={form.intro}
              onChange={(e) => setForm({ ...form, intro: e.target.value })}
              placeholder={t('introPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-cover">{t('fieldCoverImage')}</Label>
            <Input
              id="res-cover"
              value={form.coverImage}
              onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              placeholder={t('coverPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="res-file-url">{t('fieldFileUrl')}</Label>
              <Input
                id="res-file-url"
                value={form.fileUrl}
                onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                placeholder={t('fileUrlPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-file-type">{t('fieldFileType')}</Label>
              <Input
                id="res-file-type"
                value={form.fileType}
                onChange={(e) => setForm({ ...form, fileType: e.target.value })}
                placeholder={t('fileTypePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-file-size">{t('fieldFileSize')}</Label>
              <Input
                id="res-file-size"
                type="number"
                min="0"
                value={form.fileSize}
                onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="res-published"
              checked={form.isPublished}
              onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
            />
            <Label htmlFor="res-published">{t('fieldPublished')}</Label>
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
