'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { DatePicker } from '@/components/form/DatePicker'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import type { FieldConfig } from './helpers'
import type { Item, FormState } from './types'

interface VipFormDialogProps {
  open: boolean
  editing: Item | null
  form: FormState
  fields: FieldConfig[]
  dateFields: { key: string; label: string }[]
  titleCreate: string
  titleEdit: string
  descCreate: string
  descEdit: string
  isPending: boolean
  onFormChange: (form: FormState) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function VipFormDialog({
  open,
  editing,
  form,
  fields,
  dateFields,
  titleCreate,
  titleEdit,
  descCreate,
  descEdit,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: VipFormDialogProps) {
  const t = useTranslations('admin.membersLevels')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? titleEdit : titleCreate}</DialogTitle>
            <DialogDescription>{editing ? descEdit : descCreate}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>
                  {f.label}
                  {f.required ? ' *' : ''}
                </Label>
                <Input
                  value={form[f.key]}
                  onChange={(e) => onFormChange({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
            {dateFields.map((d) => (
              <DatePicker
                key={d.key}
                label={d.label}
                value={form[d.key]}
                onChange={(v) => onFormChange({ ...form, [d.key]: v })}
              />
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface VipDeleteDialogProps {
  open: boolean
  isPending: boolean
  onClose: () => void
  onConfirm: () => void
}

export function VipDeleteDialog({ open, isPending, onClose, onConfirm }: VipDeleteDialogProps) {
  const t = useTranslations('admin.membersLevels')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteDesc')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
