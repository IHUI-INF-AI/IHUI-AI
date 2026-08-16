'use client'

import { Tooltip } from '@/components/feedback'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as LucideIcons from 'lucide-react'

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
import { cn } from '@/lib/utils'

import { CATEGORY_ICONS } from './helpers'
import type { SkillCategory, SkillCategoryForm } from './types'

interface FormProps {
  open: boolean
  editing: SkillCategory | null
  defaultValues: SkillCategoryForm
  savePending: boolean
  onValid: (values: SkillCategoryForm) => void
  onClose: () => void
}

export function CategoryFormDialog({
  open,
  editing,
  defaultValues: defaultValuesProp,
  savePending,
  onValid,
  onClose,
}: FormProps) {
  const t = useTranslations('admin.skillCategories')
  const tc = useTranslations('common')
  const [form, setForm] = React.useState<SkillCategoryForm>(defaultValuesProp)
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

  function update<K extends keyof SkillCategoryForm>(key: K, value: SkillCategoryForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function renderPreviewIcon(iconName: string) {
    const Icon = (
      LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
    )[iconName]
    if (!Icon) return null
    return <Icon className="h-4 w-4" />
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
            <Label htmlFor="cat-name">{t('name')}</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={64}
              aria-invalid={!!nameErr}
            />
            {nameErr ? <p className="text-xs text-destructive">{nameErr}</p> : null}
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">{t('slug')}</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => update('slug', e.target.value)}
                placeholder={t('slugPlaceholder')}
                maxLength={64}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t('icon')}</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map((iconName) => {
                const selected = form.icon === iconName
                return (
                  <Tooltip key={iconName} content={iconName}>
                    <button
                      type="button"
                      onClick={() => update('icon', iconName)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {renderPreviewIcon(iconName)}
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-sort">{t('sort')}</Label>
            <Input
              id="cat-sort"
              type="number"
              min={0}
              value={form.sort}
              onChange={(e) => update('sort', parseInt(e.target.value) || 0)}
              placeholder="0"
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

export function CategoryDeleteDialog({ delId, delPending, onConfirm, onClose }: DeleteProps) {
  const t = useTranslations('admin.skillCategories')
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
