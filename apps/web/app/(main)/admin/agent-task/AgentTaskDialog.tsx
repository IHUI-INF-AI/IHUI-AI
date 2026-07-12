'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { AgentTask, AgentTaskForm } from './types'

interface Props {
  open: boolean
  editing: AgentTask | null
  form: AgentTaskForm
  setForm: React.Dispatch<React.SetStateAction<AgentTaskForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AgentTaskDialog({
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
            <DialogTitle>{editing ? '编辑Agent任务' : '新增Agent任务'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>需求标题 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>需求描述</Label>
            <Input
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>最低价</Label>
              <Input
                value={form.lowestPrice}
                onChange={(e) => setForm({ ...form, lowestPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>最高价</Label>
              <Input
                value={form.peakPrice}
                onChange={(e) => setForm({ ...form, peakPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>周期</Label>
              <Input
                value={form.cycle}
                onChange={(e) => setForm({ ...form, cycle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>周期单位</Label>
              <Input
                value={form.cycleUnit}
                onChange={(e) => setForm({ ...form, cycleUnit: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>截止时间</Label>
            <DatePicker
              value={form.closingTime}
              onChange={(v) => setForm({ ...form, closingTime: v as string })}
            />
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
