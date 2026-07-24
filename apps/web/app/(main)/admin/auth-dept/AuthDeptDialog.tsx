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
import { DatePicker } from '@/components/form/DatePicker'
import type { AuthDept, AuthDeptForm } from './types'

interface EditProps {
  open: boolean
  editing: AuthDept | null
  form: AuthDeptForm
  setForm: React.Dispatch<React.SetStateAction<AuthDeptForm>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthDeptDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: EditProps) {
  const t = useTranslations('adminAuthDept')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('userId')}</Label>
              <Input
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('deptId')}</Label>
              <Input
                value={form.deptId}
                onChange={(e) => setForm({ ...form, deptId: e.target.value })}
              />
            </div>
            <DatePicker
              label={t('createdAt')}
              value={form.createdAt}
              onChange={(v) => setForm({ ...form, createdAt: v })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteProps {
  delId: string | null
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AuthDeptDeleteDialog({ delId, pending, onCancel, onConfirm }: DeleteProps) {
  const t = useTranslations('adminAuthDept')
  return (
    <Dialog
      open={delId !== null}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteDesc')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
