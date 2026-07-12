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
} from '@ihui/ui'
import type { PayLog, CForm } from './types'

interface Props {
  open: boolean
  editing: PayLog | null
  form: CForm
  onFormChange: (patch: Partial<CForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function PayLogDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑支付日志' : '新建支付日志'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pl-user">用户UUID *</Label>
              <Input
                id="pl-user"
                value={form.userUuid}
                onChange={(e) => onFormChange({ userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-course">课程ID</Label>
              <Input
                id="pl-course"
                value={form.courseId}
                onChange={(e) => onFormChange({ courseId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-video">视频ID</Label>
              <Input
                id="pl-video"
                value={form.videoId}
                onChange={(e) => onFormChange({ videoId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-outBillOn">账单日期 *</Label>
              <Input
                id="pl-outBillOn"
                type="date"
                value={form.outBillOn}
                onChange={(e) => onFormChange({ outBillOn: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-payWay">支付方式</Label>
              <Input
                id="pl-payWay"
                value={form.payWay}
                onChange={(e) => onFormChange({ payWay: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-amount">金额</Label>
              <Input
                id="pl-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => onFormChange({ amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-realAmount">实付金额</Label>
              <Input
                id="pl-realAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.realAmount}
                onChange={(e) => onFormChange({ realAmount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
