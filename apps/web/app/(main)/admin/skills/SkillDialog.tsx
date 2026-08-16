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
} from '@ihui/ui-react'

import type { Skill, SkillForm } from './types'

interface FormProps {
  open: boolean
  editing: Skill | null
  defaultValues: SkillForm
  savePending: boolean
  onValid: (values: SkillForm) => void
  onClose: () => void
}

export function SkillFormDialog({
  open,
  editing,
  defaultValues: defaultValuesProp,
  savePending,
  onValid,
  onClose,
}: FormProps) {
  const t = useTranslations('admin.skills')
  const tc = useTranslations('common')
  const [form, setForm] = React.useState<SkillForm>(defaultValuesProp)
  const [nameErr, setNameErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    setForm(defaultValuesProp)
    setNameErr(null)
  }, [editing?.id, open, defaultValuesProp])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameErr(null)
    if (!form.name.trim()) {
      setNameErr(t('nameRequired'))
      return
    }
    onValid(form)
  }

  function update<K extends keyof SkillForm>(key: K, value: SkillForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">{t('name')}</Label>
            <Input
              id="skill-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={128}
              aria-invalid={!!nameErr}
            />
            {nameErr ? <p className="text-xs text-destructive">{nameErr}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-desc">{t('description')}</Label>
            <textarea
              id="skill-desc"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={t('descPlaceholder')}
              maxLength={1000}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-version">{t('version')}</Label>
            <Input
              id="skill-version"
              value={form.version}
              onChange={(e) => update('version', e.target.value)}
              placeholder="1.0.0"
              maxLength={32}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-tags">{t('tags')}</Label>
            <Input
              id="skill-tags"
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              placeholder={t('tagsPlaceholder')}
            />
          </div>
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

export function SkillDeleteDialog({ delId, delPending, onConfirm, onClose }: DeleteProps) {
  const t = useTranslations('admin.skills')
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
