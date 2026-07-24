'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'
import type { ZhsActivity, ZhsActivityForm } from './types'

interface Props {
  open: boolean
  editing: ZhsActivity | null
  form: ZhsActivityForm
  setForm: React.Dispatch<React.SetStateAction<ZhsActivityForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ZhsActivityDialog({
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
            <DialogTitle>{editing ? '编辑ZHS活动' : '新增ZHS活动'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>活动名称 *</Label>
            <Input
              value={form.activityName}
              onChange={(e) => setForm({ ...form, activityName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>活动规则</Label>
            <Input
              value={form.activityRule}
              onChange={(e) => setForm({ ...form, activityRule: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>活动充值</Label>
            <Input
              value={form.activityRecharge}
              onChange={(e) => setForm({ ...form, activityRecharge: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>起始金额</Label>
              <Input
                value={form.beginAmount}
                onChange={(e) => setForm({ ...form, beginAmount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>倍数</Label>
              <Input
                value={form.multiple}
                onChange={(e) => setForm({ ...form, multiple: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>计算方式</Label>
              <Input
                value={form.computing}
                onChange={(e) => setForm({ ...form, computing: e.target.value })}
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
