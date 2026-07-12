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
import type { ExamineForm } from './types'

interface ExamineDialogProps {
  open: boolean
  editing: boolean
  form: ExamineForm
  err: string | null
  isPending: boolean
  onFormChange: (form: ExamineForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function ExamineDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: ExamineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑审核' : '新增审核'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>AgentID *</Label>
              <Input
                value={form.agentId}
                onChange={(e) => onFormChange({ ...form, agentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Agent名称</Label>
              <Input
                value={form.agentName}
                onChange={(e) => onFormChange({ ...form, agentName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>开始时间</Label>
              <DatePicker
                value={form.startTime}
                onChange={(v) => onFormChange({ ...form, startTime: v as string })}
              />
            </div>
            <div className="space-y-2">
              <Label>联系电话</Label>
              <Input
                value={form.startPhone}
                onChange={(e) => onFormChange({ ...form, startPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>联系人</Label>
              <Input
                value={form.startName}
                onChange={(e) => onFormChange({ ...form, startName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>审核人</Label>
              <Input
                value={form.examineUser}
                onChange={(e) => onFormChange({ ...form, examineUser: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>描述</Label>
            <Input
              value={form.desc}
              onChange={(e) => onFormChange({ ...form, desc: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>关注</Label>
            <Input
              value={form.follow}
              onChange={(e) => onFormChange({ ...form, follow: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>开场白</Label>
            <Input
              value={form.prologue}
              onChange={(e) => onFormChange({ ...form, prologue: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.status}
              onCheckedChange={(v) => onFormChange({ ...form, status: v })}
            />
            <Label>启用</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
