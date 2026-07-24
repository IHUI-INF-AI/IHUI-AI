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
import type { AuthVeriCode, AuthVeriCodeForm } from './types'

interface DialogProps {
  open: boolean
  editing: AuthVeriCode | null
  form: AuthVeriCodeForm
  onFormChange: (patch: Partial<AuthVeriCodeForm>) => void
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthVeriCodeDialog({
  open,
  editing,
  form,
  onFormChange,
  savePending,
  onSubmit,
  onClose,
}: DialogProps) {
  const t = useTranslations('adminAuthVeriCode')
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('userId')}</Label>
              <Input
                value={form.userId}
                onChange={(e) => onFormChange({ userId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('phone')}</Label>
              <Input value={form.phone} onChange={(e) => onFormChange({ phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('code')}</Label>
              <Input value={form.code} onChange={(e) => onFormChange({ code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('type')}</Label>
              <Input
                value={form.type}
                onChange={(e) => onFormChange({ type: e.target.value })}
                placeholder="register/login"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('platform')}</Label>
              <Input
                value={form.platform}
                onChange={(e) => onFormChange({ platform: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('ip')}</Label>
              <Input value={form.ip} onChange={(e) => onFormChange({ ip: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('used')}</Label>
              <Input
                value={form.used}
                onChange={(e) => onFormChange({ used: e.target.value })}
                placeholder="0/1"
              />
            </div>
            <DatePicker
              label={t('expiresAt')}
              value={form.expiresAt}
              onChange={(v) => onFormChange({ expiresAt: v })}
            />
            <DatePicker
              label={t('usedAt')}
              value={form.usedAt}
              onChange={(v) => onFormChange({ usedAt: v })}
            />
            <DatePicker
              label={t('createdAt')}
              value={form.createdAt}
              onChange={(v) => onFormChange({ createdAt: v })}
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
  open: boolean
  onClose: () => void
  onConfirm: () => void
  pending: boolean
}

export function AuthVeriCodeDeleteDialog({ open, onClose, onConfirm, pending }: DeleteProps) {
  const t = useTranslations('adminAuthVeriCode')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteDesc')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
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
