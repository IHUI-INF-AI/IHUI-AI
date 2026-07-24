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
} from '@ihui/ui-react'
import type { Company, CompanyForm } from './types'

interface CompanyDialogProps {
  open: boolean
  editing: Company | null
  form: CompanyForm
  err: string | null
  isPending: boolean
  onFormChange: (form: CompanyForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function CompanyDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: CompanyDialogProps) {
  const t = useTranslations('admin.member')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-xl">
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
            <Label htmlFor="c-name">{t('fieldName')}</Label>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-contact">{t('fieldContactName')}</Label>
              <Input
                id="c-contact"
                value={form.contactName}
                onChange={(e) => onFormChange({ ...form, contactName: e.target.value })}
                placeholder={t('contactNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">{t('fieldContactPhone')}</Label>
              <Input
                id="c-phone"
                value={form.contactPhone}
                onChange={(e) => onFormChange({ ...form, contactPhone: e.target.value })}
                placeholder={t('contactPhonePlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-address">{t('fieldAddress')}</Label>
            <Input
              id="c-address"
              value={form.address}
              onChange={(e) => onFormChange({ ...form, address: e.target.value })}
              placeholder={t('addressPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-remark">{t('fieldRemark')}</Label>
            <Input
              id="c-remark"
              value={form.remark}
              onChange={(e) => onFormChange({ ...form, remark: e.target.value })}
              placeholder={t('remarkPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-sort">{t('fieldSort')}</Label>
              <Input
                id="c-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => onFormChange({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-status">{t('fieldStatus')}</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="c-status"
                  checked={form.status}
                  onCheckedChange={(v) => onFormChange({ ...form, status: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.status ? t('enabled') : t('disabled')}
                </span>
              </div>
            </div>
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
