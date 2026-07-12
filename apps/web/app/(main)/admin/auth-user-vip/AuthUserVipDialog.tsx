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
import type { AuthUserVip, AuthUserVipForm } from './types'

interface Props {
  open: boolean
  editing: AuthUserVip | null
  form: AuthUserVipForm
  onFormChange: (patch: Partial<AuthUserVipForm>) => void
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthUserVipDialog({
  open,
  editing,
  form,
  onFormChange,
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
            <DialogTitle>{editing ? '编辑用户VIP进度' : '新增用户VIP进度'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改用户VIP进度信息' : '添加新的用户VIP进度'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>用户UUID</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => onFormChange({ userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>VIP ID *</Label>
              <Input value={form.vipId} onChange={(e) => onFormChange({ vipId: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>进度 *</Label>
              <Input
                value={form.progress}
                onChange={(e) => onFormChange({ progress: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>创建者</Label>
              <Input
                value={form.creator}
                onChange={(e) => onFormChange({ creator: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>是否有效</Label>
              <Input
                value={form.isValid}
                onChange={(e) => onFormChange({ isValid: e.target.value })}
                placeholder="0/1"
              />
            </div>
            <DatePicker
              label="创建时间"
              value={form.createdTime}
              onChange={(v) => onFormChange({ createdTime: v })}
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
