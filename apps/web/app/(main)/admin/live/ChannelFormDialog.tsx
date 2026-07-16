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
import { TiptapRichText } from '@/components/form/TiptapRichText'
import {
  type Channel,
  type Category,
  type Lecturer,
  type ChannelForm,
  EMPTY_FORM,
  toLocalInput,
  selectClass,
  api,
} from './types'

function splitIds(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function ChannelFormDialog({
  open,
  editing,
  categories,
  lecturers,
  onClose,
  t,
}: {
  open: boolean
  editing: Channel | null
  categories: Category[]
  lecturers: Lecturer[]
  onClose: () => void
  t: ReturnType<typeof useTranslations<'admin.live'>>
}) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState<ChannelForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  function update<K extends keyof ChannelForm>(key: K, value: ChannelForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title,
          categoryId: editing.categoryId ?? '',
          lecturerId: editing.lecturerId ?? '',
          lecturerName: editing.lecturerName ?? '',
          intro: editing.intro ?? '',
          introduction: editing.introduction ?? '',
          cidList: editing.cidList ?? [],
          showNumber: String(editing.showNumber ?? 0),
          enableChat: editing.enableChat ?? false,
          coverImage: editing.coverImage ?? '',
          pushUrl: editing.pushUrl ?? '',
          playUrl: editing.playUrl ?? '',
          startTime: toLocalInput(editing.startTime),
          endTime: toLocalInput(editing.endTime),
          isLive: editing.isLive,
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
        lecturerId: form.lecturerId || null,
        lecturerName: form.lecturerName.trim() || null,
        intro: form.intro.trim() || null,
        introduction: form.introduction.trim() || null,
        cidList: form.cidList,
        showNumber: Number(form.showNumber) || 0,
        enableChat: form.enableChat,
        coverImage: form.coverImage.trim() || null,
        pushUrl: form.pushUrl.trim() || null,
        playUrl: form.playUrl.trim() || null,
        startTime: form.startTime ? new Date(form.startTime).toISOString() : null,
        endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
        isLive: form.isLive,
        isPublished: form.isPublished,
        sort: Number(form.sort) || 0,
      }
      if (editing) {
        return api<{ channel: Channel }>(`/api/admin/live/channels/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ channel: Channel }>(`/api/admin/live/channels`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'live', 'channels'] })
      qc.invalidateQueries({ queryKey: ['live', 'statistics'] })
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
            <Label htmlFor="ch-title">{t('fieldTitle')}</Label>
            <Input
              id="ch-title"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-category">{t('fieldCategory')}</Label>
              <Select
                value={form.categoryId || 'none'}
                onValueChange={(v) => update('categoryId', v === 'none' ? '' : v)}
              >
                <SelectTrigger className={selectClass} id="ch-category">
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
              <Label htmlFor="ch-lecturer">{t('fieldLecturer')}</Label>
              <Select
                value={form.lecturerId || 'none'}
                onValueChange={(v) => update('lecturerId', v === 'none' ? '' : v)}
              >
                <SelectTrigger className={selectClass} id="ch-lecturer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noLecturer')}</SelectItem>
                  {lecturers.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-sort">{t('fieldSort')}</Label>
              <Input
                id="ch-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => update('sort', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-intro">{t('fieldIntro')}</Label>
            <Input
              id="ch-intro"
              value={form.intro}
              onChange={(e) => update('intro', e.target.value)}
              placeholder={t('introPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-intro-rt">{t('fieldIntroduction')}</Label>
            <TiptapRichText
              value={form.introduction}
              onChange={(v) => update('introduction', v)}
              placeholder={t('introductionPlaceholder')}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-cid">{t('fieldCidList')}</Label>
            <Input
              id="ch-cid"
              value={form.cidList.join(',')}
              onChange={(e) => update('cidList', splitIds(e.target.value))}
              placeholder={t('cidListPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-shownum">{t('fieldShowNumber')}</Label>
              <Input
                id="ch-shownum"
                type="number"
                min="0"
                value={form.showNumber}
                onChange={(e) => update('showNumber', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id="ch-chat"
                checked={form.enableChat}
                onCheckedChange={(v) => update('enableChat', v)}
              />
              <Label htmlFor="ch-chat">{t('fieldEnableChat')}</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-cover">{t('fieldCoverImage')}</Label>
            <Input
              id="ch-cover"
              value={form.coverImage}
              onChange={(e) => update('coverImage', e.target.value)}
              placeholder={t('coverPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-push">{t('fieldPushUrl')}</Label>
              <Input
                id="ch-push"
                value={form.pushUrl}
                onChange={(e) => update('pushUrl', e.target.value)}
                placeholder={t('pushUrlPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-play">{t('fieldPlayUrl')}</Label>
              <Input
                id="ch-play"
                value={form.playUrl}
                onChange={(e) => update('playUrl', e.target.value)}
                placeholder={t('playUrlPlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-start">{t('fieldStartTime')}</Label>
              <Input
                id="ch-start"
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => update('startTime', e.target.value)}
                placeholder={t('timePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-end">{t('fieldEndTime')}</Label>
              <Input
                id="ch-end"
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => update('endTime', e.target.value)}
                placeholder={t('timePlaceholder')}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="ch-live"
                checked={form.isLive}
                onCheckedChange={(v) => update('isLive', v)}
              />
              <Label htmlFor="ch-live">{t('fieldIsLive')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ch-published"
                checked={form.isPublished}
                onCheckedChange={(v) => update('isPublished', v)}
              />
              <Label htmlFor="ch-published">{t('fieldPublished')}</Label>
            </div>
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
