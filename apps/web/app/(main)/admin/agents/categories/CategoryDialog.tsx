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
  Switch,
} from '@ihui/ui'
import type { CategoryForm } from './types'

interface CategoryDialogProps {
  open: boolean
  editing: boolean
  form: CategoryForm
  err: string | null
  isPending: boolean
  onFormChange: (form: CategoryForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function CategoryDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: CategoryDialogProps) {
  const t = useTranslations('admin.agents.categories')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">
              {t('fieldName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">{t('fieldDescription')}</Label>
            <textarea
              id="cat-desc"
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cat-icon">{t('fieldIcon')}</Label>
              <Input
                id="cat-icon"
                value={form.icon}
                onChange={(e) => onFormChange({ ...form, icon: e.target.value })}
                placeholder={t('fieldIconPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-sort">{t('fieldSort')}</Label>
              <Input
                id="cat-sort"
                type="number"
                min={0}
                value={form.sort}
                onChange={(e) => onFormChange({ ...form, sort: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="cat-status"
                checked={form.status}
                onCheckedChange={(v) => onFormChange({ ...form, status: v })}
              />
              <Label htmlFor="cat-status" className="cursor-pointer">
                {t('fieldStatus')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="cat-paid"
                checked={form.isPaid}
                onCheckedChange={(v) => onFormChange({ ...form, isPaid: v })}
              />
              <Label htmlFor="cat-paid" className="cursor-pointer">
                {t('fieldIsPaid')}
              </Label>
            </div>
          </div>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
