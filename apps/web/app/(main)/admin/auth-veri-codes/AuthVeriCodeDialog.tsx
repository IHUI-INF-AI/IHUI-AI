'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { AuthVeriCode, AuthVeriCodeForm } from './types'

interface DialogProps {
  open: boolean
  editing: AuthVeriCode | null
  form: AuthVeriCodeForm
  onFormChange: (patch: Partial<AuthVeriCodeForm>) => void
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthVeriCodeDialog({
  open,
  editing,
  form,
  onFormChange,
  savePending,
  onSubmit,
  onClose,
}: DialogProps) {
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
            <DialogTitle>{editing ? '编辑验证码记录' : '新增验证码记录'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改验证码记录信息' : '添加新的验证码记录'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>用户ID *</Label>
              <Input
                value={form.userId}
                onChange={(e) => onFormChange({ userId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>手机号 *</Label>
              <Input value={form.phone} onChange={(e) => onFormChange({ phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>验证码 *</Label>
              <Input value={form.code} onChange={(e) => onFormChange({ code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>类型 *</Label>
              <Input
                value={form.type}
                onChange={(e) => onFormChange({ type: e.target.value })}
                placeholder="register/login"
              />
            </div>
            <div className="space-y-1.5">
              <Label>平台</Label>
              <Input
                value={form.platform}
                onChange={(e) => onFormChange({ platform: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IP</Label>
              <Input value={form.ip} onChange={(e) => onFormChange({ ip: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>是否已用</Label>
              <Input
                value={form.used}
                onChange={(e) => onFormChange({ used: e.target.value })}
                placeholder="0/1"
              />
            </div>
            <DatePicker
              label="过期时间"
              value={form.expiresAt}
              onChange={(v) => onFormChange({ expiresAt: v })}
            />
            <DatePicker
              label="使用时间"
              value={form.usedAt}
              onChange={(v) => onFormChange({ usedAt: v })}
            />
            <DatePicker
              label="创建时间"
              value={form.createdAt}
              onChange={(v) => onFormChange({ createdAt: v })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  pending: boolean
}

export function AuthVeriCodeDeleteDialog({ open, onClose, onConfirm, pending }: DeleteProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>确定要删除该验证码记录吗？此操作不可撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            取消
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
