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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import type { CozeAccount, CozeForm } from './types'

interface DeveloperCozeDialogProps {
  open: boolean
  editing: CozeAccount | null
  form: CozeForm
  err: string | null
  isPending: boolean
  onFormChange: (form: CozeForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function DeveloperCozeDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: DeveloperCozeDialogProps) {
  const t = useTranslations('admin.developer')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('cozeEditTitle') : t('cozeCreateTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cz-id">{t('fieldCozeId')}</Label>
              <Input
                id="cz-id"
                value={form.cozeId}
                onChange={(e) => onFormChange({ ...form, cozeId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cz-account">{t('fieldSignAccount')}</Label>
              <Input
                id="cz-account"
                value={form.signAccount}
                onChange={(e) => onFormChange({ ...form, signAccount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cz-pwd">{t('fieldSignPassword')}</Label>
              <Input
                id="cz-pwd"
                value={form.signPassword}
                onChange={(e) => onFormChange({ ...form, signPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cz-nick">{t('fieldSignNickname')}</Label>
              <Input
                id="cz-nick"
                value={form.signNickname}
                onChange={(e) => onFormChange({ ...form, signNickname: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cz-platform">{t('fieldPlatform')}</Label>
              <Input
                id="cz-platform"
                value={form.platform}
                onChange={(e) => onFormChange({ ...form, platform: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cz-status">{t('fieldStatus')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => onFormChange({ ...form, status: v })}
              >
                <SelectTrigger id="cz-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('statusUnused')}</SelectItem>
                  <SelectItem value="1">{t('statusInUse')}</SelectItem>
                  <SelectItem value="2">{t('statusExpired')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cz-addr">{t('fieldAddress')}</Label>
            <Input
              id="cz-addr"
              value={form.address}
              onChange={(e) => onFormChange({ ...form, address: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
