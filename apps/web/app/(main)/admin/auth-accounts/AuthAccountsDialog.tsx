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
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'
import type { AuthAccount, AuthAccountForm } from './types'

interface AuthAccountEditDialogProps {
  open: boolean
  editing: AuthAccount | null
  form: AuthAccountForm
  isPending: boolean
  onFormChange: (form: AuthAccountForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function AuthAccountEditDialog({
  open,
  editing,
  form,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: AuthAccountEditDialogProps) {
  const t = useTranslations('adminAuthAccounts')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('userUuid')}</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => onFormChange({ ...form, userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('platform')}</Label>
              <Input
                value={form.platform}
                onChange={(e) => onFormChange({ ...form, platform: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('openId')}</Label>
              <Input
                value={form.openId}
                onChange={(e) => onFormChange({ ...form, openId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('platformName')}</Label>
              <Input
                value={form.platformName}
                onChange={(e) => onFormChange({ ...form, platformName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('accessToken')}</Label>
              <Input
                value={form.accessToken}
                onChange={(e) => onFormChange({ ...form, accessToken: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('refreshToken')}</Label>
              <Input
                value={form.refreshToken}
                onChange={(e) => onFormChange({ ...form, refreshToken: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('nickname')}</Label>
              <Input
                value={form.nickname}
                onChange={(e) => onFormChange({ ...form, nickname: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('avatar')}</Label>
              <Input
                value={form.avatar}
                onChange={(e) => onFormChange({ ...form, avatar: e.target.value })}
              />
            </div>
            <DatePicker
              label={t('expiresAt')}
              value={form.expiresAt}
              onChange={(v) => onFormChange({ ...form, expiresAt: v })}
            />
            <DatePicker
              label={t('bindTime')}
              value={form.bindTime}
              onChange={(v) => onFormChange({ ...form, bindTime: v })}
            />
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

interface AuthAccountDeleteDialogProps {
  delId: string | null
  isPending: boolean
  onClose: () => void
  onConfirm: (id: string) => void
}

export function AuthAccountDeleteDialog({
  delId,
  isPending,
  onClose,
  onConfirm,
}: AuthAccountDeleteDialogProps) {
  const t = useTranslations('adminAuthAccounts')
  return (
    <Dialog
      open={delId !== null}
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
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => delId && onConfirm(delId)}
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
