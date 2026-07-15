'use client'

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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

import type { TitleForm } from './types'

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export interface TitleDialogProps {
  open: boolean
  setOpen: (v: boolean) => void
  editing: boolean
  form: TitleForm
  setForm: (v: TitleForm) => void
  err: string | null
  saving: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function TitleDialog(props: TitleDialogProps) {
  const { open, setOpen, editing, form, setForm, err, saving, onClose, onSubmit } = props
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : onClose())}>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑抬头' : '新建抬头'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="it-name">抬头名称</Label>
              <Input id="it-name" value={form.titleName} onChange={(e) => setForm({ ...form, titleName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-type">类型</Label>
              <Select value={form.titleType} onValueChange={(v) => setForm({ ...form, titleType: v as 'company' | 'personal' })}>
                <SelectTrigger className={selectClass} id="it-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">企业</SelectItem>
                  <SelectItem value="personal">个人</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="it-tax">税号</Label>
            <Input id="it-tax" value={form.taxNo} onChange={(e) => setForm({ ...form, taxNo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="it-bank">开户银行</Label>
              <Input id="it-bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-account">银行账号</Label>
              <Input id="it-account" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="it-address">地址</Label>
              <Input id="it-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-phone">电话</Label>
              <Input id="it-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            设为默认抬头
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
