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
import type { AuthUserVip, AuthUserVipForm } from './types'

interface Props {
  open: boolean
  editing: AuthUserVip | null
  form: AuthUserVipForm
  onFormChange: (patch: Partial<AuthUserVipForm>) => void
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthUserVipDialog({
  open,
  editing,
  form,
  onFormChange,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('adminAuthUserVip')
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
              <Label>{t('labelUserUuid')}</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => onFormChange({ userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('labelVipId')}</Label>
              <Input value={form.vipId} onChange={(e) => onFormChange({ vipId: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('labelProgress')}</Label>
              <Input
                value={form.progress}
                onChange={(e) => onFormChange({ progress: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('labelCreator')}</Label>
              <Input
                value={form.creator}
                onChange={(e) => onFormChange({ creator: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('labelIsValid')}</Label>
              <Input
                value={form.isValid}
                onChange={(e) => onFormChange({ isValid: e.target.value })}
                placeholder="0/1"
              />
            </div>
            <DatePicker
              label={t('labelCreatedTime')}
              value={form.createdTime}
              onChange={(v) => onFormChange({ createdTime: v })}
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
