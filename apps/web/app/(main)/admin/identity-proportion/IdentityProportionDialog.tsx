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
import { DatePicker } from '@/components/form/DatePicker'
import type { IdentityProportion, IdentityProportionForm } from './types'

interface Props {
  open: boolean
  editing: IdentityProportion | null
  form: IdentityProportionForm
  setForm: React.Dispatch<React.SetStateAction<IdentityProportionForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function IdentityProportionDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.identityProportion')
  const tc = useTranslations('common')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('identityType')}</Label>
            <Input
              value={form.identityType}
              onChange={(e) => setForm({ ...form, identityType: e.target.value })}
              placeholder={t('identityTypePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('gift')}</Label>
              <Input
                value={form.gift}
                onChange={(e) => setForm({ ...form, gift: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('tokenProportion')}</Label>
              <Input
                value={form.tokenProportion}
                onChange={(e) => setForm({ ...form, tokenProportion: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('vipGift')}</Label>
              <Input
                value={form.vipGift}
                onChange={(e) => setForm({ ...form, vipGift: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('routineProportion')}</Label>
              <Input
                value={form.routineProportion}
                onChange={(e) => setForm({ ...form, routineProportion: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('beginTime')}</Label>
              <DatePicker
                value={form.beginTime}
                onChange={(v) => setForm({ ...form, beginTime: v as string })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('endTime')}</Label>
              <DatePicker
                value={form.endTime}
                onChange={(v) => setForm({ ...form, endTime: v as string })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.status}
              onCheckedChange={(v) => setForm({ ...form, status: v })}
            />
            <Label>{t('statusEnabled')}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
