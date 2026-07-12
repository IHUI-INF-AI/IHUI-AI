'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
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
import type { ProductIdentity, ProductIdentityForm } from './types'

interface Props {
  open: boolean
  editing: ProductIdentity | null
  form: ProductIdentityForm
  setForm: React.Dispatch<React.SetStateAction<ProductIdentityForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ProductIdentityDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
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
            <DialogTitle>{editing ? '编辑产品身份' : '新增产品身份'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>产品名称</Label>
            <Input
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              placeholder="请输入产品名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>金额 *</Label>
              <Input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="请输入金额"
              />
            </div>
            <div className="space-y-2">
              <Label>默认金额</Label>
              <Input
                value={form.defAmount}
                onChange={(e) => setForm({ ...form, defAmount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>开始时间</Label>
              <DatePicker
                value={form.beginTime}
                onChange={(v) => setForm({ ...form, beginTime: v as string })}
              />
            </div>
            <div className="space-y-2">
              <Label>结束时间</Label>
              <DatePicker
                value={form.endTime}
                onChange={(v) => setForm({ ...form, endTime: v as string })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="请输入备注"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.status}
              onCheckedChange={(v) => setForm({ ...form, status: v })}
            />
            <Label>启用</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
