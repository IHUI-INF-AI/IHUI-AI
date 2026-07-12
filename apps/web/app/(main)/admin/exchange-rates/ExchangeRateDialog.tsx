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
} from '@ihui/ui'
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
            <DialogTitle>{editing ? '编辑汇率' : '新增汇率'}</DialogTitle>
            <DialogDescription>{editing ? '修改汇率信息' : '添加新的汇率记录'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="er-from">源货币</Label>
              <Input
                id="er-from"
                value={form.fromCurrency}
                onChange={(e) => setForm({ ...form, fromCurrency: e.target.value })}
                placeholder="如 USD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="er-to">目标货币</Label>
              <Input
                id="er-to"
                value={form.toCurrency}
                onChange={(e) => setForm({ ...form, toCurrency: e.target.value })}
                placeholder="如 CNY"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="er-rate">汇率</Label>
              <Input
                id="er-rate"
                type="number"
                step="0.0001"
                min="0"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="如 7.25"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="er-status">状态</Label>
              <Select
                value={String(form.status)}
                onValueChange={(v) => setForm({ ...form, status: Number(v) })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">启用</SelectItem>
                  <SelectItem value="0">禁用</SelectItem>
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
