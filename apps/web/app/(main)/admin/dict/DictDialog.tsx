'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { textareaClass } from './helpers'
import type { DictType, DictItem, TypeForm, ItemForm } from './types'

interface DictTypeDialogProps {
  open: boolean
  editing: DictType | null
  form: TypeForm
  isPending: boolean
  onFormChange: (form: TypeForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function DictTypeDialog({
  open,
  editing,
  form,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: DictTypeDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('dict.editTypeTitle') : t('dict.createTypeTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dt-name">{t('dict.fieldName')}</Label>
            <Input
              id="dt-name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder={t('dict.namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dt-code">{t('dict.fieldCode')}</Label>
            <Input
              id="dt-code"
              value={form.code}
              onChange={(e) => onFormChange({ ...form, code: e.target.value })}
              placeholder="order_status"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dt-desc">{t('dict.fieldDescription')}</Label>
            <textarea
              id="dt-desc"
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={2}
              className={textareaClass}
              placeholder={t('dict.descriptionPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DictItemDialogProps {
  open: boolean
  editing: DictItem | null
  parent: DictType | null
  form: ItemForm
  isPending: boolean
  onFormChange: (form: ItemForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function DictItemDialog({
  open,
  editing,
  parent,
  form,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: DictItemDialogProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('dict.editItemTitle') : t('dict.createItemTitle')}
              {parent && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({parent.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="di-label">{t('dict.fieldLabel')}</Label>
            <Input
              id="di-label"
              value={form.label}
              onChange={(e) => onFormChange({ ...form, label: e.target.value })}
              placeholder={t('dict.labelPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="di-value">{t('dict.fieldValue')}</Label>
            <Input
              id="di-value"
              value={form.value}
              onChange={(e) => onFormChange({ ...form, value: e.target.value })}
              placeholder="pending"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="di-sort">{t('dict.fieldSort')}</Label>
            <Input
              id="di-sort"
              type="number"
              value={form.sort}
              onChange={(e) => onFormChange({ ...form, sort: Number(e.target.value) })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
