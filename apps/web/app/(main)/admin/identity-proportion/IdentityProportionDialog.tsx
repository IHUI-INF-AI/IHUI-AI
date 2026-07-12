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
            <DialogTitle>{editing ? '编辑身份比例' : '新增身份比例'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>身份类型</Label>
            <Input
              value={form.identityType}
              onChange={(e) => setForm({ ...form, identityType: e.target.value })}
              placeholder="请输入身份类型"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>赠送</Label>
              <Input
                value={form.gift}
                onChange={(e) => setForm({ ...form, gift: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Token比例</Label>
              <Input
                value={form.tokenProportion}
                onChange={(e) => setForm({ ...form, tokenProportion: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>VIP赠送</Label>
              <Input
                value={form.vipGift}
                onChange={(e) => setForm({ ...form, vipGift: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>常规比例</Label>
              <Input
                value={form.routineProportion}
                onChange={(e) => setForm({ ...form, routineProportion: e.target.value })}
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
