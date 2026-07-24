'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { selectClass } from './helpers'
import type { ExchangeRate, ExchangeRateForm } from './types'

interface Props {
  open: boolean
  editing: ExchangeRate | null
  form: ExchangeRateForm
  setForm: React.Dispatch<React.SetStateAction<ExchangeRateForm>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ExchangeRateDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.exchangeRates')
  const tc = useTranslations('common')
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
            <div className="space-y-2">
              <Label htmlFor="er-from">{t('fromCurrency')}</Label>
              <Input
                id="er-from"
                value={form.fromCurrency}
                onChange={(e) => setForm({ ...form, fromCurrency: e.target.value })}
                placeholder={t('fromCurrencyPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="er-to">{t('toCurrency')}</Label>
              <Input
                id="er-to"
                value={form.toCurrency}
                onChange={(e) => setForm({ ...form, toCurrency: e.target.value })}
                placeholder={t('toCurrencyPlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="er-rate">{t('rate')}</Label>
              <Input
                id="er-rate"
                type="number"
                step="0.0001"
                min="0"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder={t('ratePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="er-status">{t('status')}</Label>
              <Select
                value={String(form.status)}
                onValueChange={(v) => setForm({ ...form, status: Number(v) })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('statusEnabled')}</SelectItem>
                  <SelectItem value="0">{t('statusDisabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
