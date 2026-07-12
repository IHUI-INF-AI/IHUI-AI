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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { selectClass } from '@/lib/edu'
import type { CoursePay, CForm } from './types'

interface Props {
  open: boolean
  editing: CoursePay | null
  form: CForm
  setForm: React.Dispatch<React.SetStateAction<CForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function CoursePayDialog({
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
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑课程付费' : '新建课程付费'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cp-course">课程ID</Label>
            <Input
              id="cp-course"
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cp-type">付费类型</Label>
              <Select value={form.payType} onValueChange={(v) => setForm({ ...form, payType: v })}>
                <SelectTrigger className={selectClass} id="cp-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">免费</SelectItem>
                  <SelectItem value="1">限免</SelectItem>
                  <SelectItem value="2">付费</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-crowd">付费人群</Label>
              <Select
                value={form.payCrowd}
                onValueChange={(v) => setForm({ ...form, payCrowd: v })}
              >
                <SelectTrigger className={selectClass} id="cp-crowd">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">全部</SelectItem>
                  <SelectItem value="1">会员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-amount">金额</Label>
            <Input
              id="cp-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
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
