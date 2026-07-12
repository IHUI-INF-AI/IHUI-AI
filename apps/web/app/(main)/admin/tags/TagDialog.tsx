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
} from '@ihui/ui'

import type { TagItem, TagForm } from './types'

interface FormProps {
  open: boolean
  editing: TagItem | null
  form: TagForm
  setForm: React.Dispatch<React.SetStateAction<TagForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function TagFormDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: FormProps) {
  const t = useTranslations('admin.tags')
  const tc = useTranslations('common')
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">{t('name')}</Label>
            <Input
              id="tag-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('namePlaceholder')}
              maxLength={64}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-desc">{t('description')}</Label>
            <Input
              id="tag-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('descPlaceholder')}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-color">{t('color')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tag-color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="#3b82f6"
                className="flex-1"
              />
              {form.color ? (
                <span
                  className="h-9 w-9 shrink-0 rounded-md border"
                  style={{ backgroundColor: form.color }}
                />
              ) : null}
            </div>
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {editing ? tc('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteProps {
  delId: string | null
  delPending: boolean
  onConfirm: () => void
  onClose: () => void
}

export function TagDeleteDialog({ delId, delPending, onConfirm, onClose }: DeleteProps) {
  const t = useTranslations('admin.tags')
  const tc = useTranslations('common')
  return (
    <Dialog
      open={delId !== null}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={delPending}>
            {tc('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={delPending} onClick={onConfirm}>
            {delPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {tc('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
