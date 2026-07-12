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
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { LoginLog, LoginLogForm } from './types'

interface Props {
  open: boolean
  editing: LoginLog | null
  form: LoginLogForm
  setForm: React.Dispatch<React.SetStateAction<LoginLogForm>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function LoginLogDialog({
  open,
  editing,
  form,
  setForm,
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
            <DialogTitle>{editing ? '编辑登录日志' : '新增登录日志'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改登录日志信息' : '添加新的登录日志'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>用户UUID *</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>登录类型 *</Label>
              <Input
                value={form.loginType}
                onChange={(e) => setForm({ ...form, loginType: e.target.value })}
                placeholder="sms/password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>平台</Label>
              <Input
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IP</Label>
              <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>位置</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <DatePicker
              label="登录时间"
              value={form.loginTime}
              onChange={(v) => setForm({ ...form, loginTime: v })}
            />
            <div className="col-span-2 space-y-1.5">
              <Label>UserAgent</Label>
              <Input
                value={form.userAgent}
                onChange={(e) => setForm({ ...form, userAgent: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>消息</Label>
              <Input
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
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
