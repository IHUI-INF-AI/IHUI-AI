'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { DatePicker } from '@/components/form/DatePicker'
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
import type { UserCenter, UserForm } from './types'

interface Props {
  open: boolean
  editing: UserCenter | null
  form: UserForm
  onFormChange: (patch: Partial<UserForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
}

export function UserCenterEditDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
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
            <DialogTitle>{editing ? '编辑用户' : '新增用户'}</DialogTitle>
            <DialogDescription>{editing ? '修改用户信息' : '添加新用户'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>昵称</Label>
              <Input
                value={form.nickname}
                onChange={(e) => onFormChange({ nickname: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>头像URL</Label>
              <Input
                value={form.avatar}
                onChange={(e) => onFormChange({ avatar: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>性别</Label>
              <Input
                value={form.gender}
                onChange={(e) => onFormChange({ gender: e.target.value })}
                placeholder="0/1/2"
              />
            </div>
            <DatePicker
              label="生日"
              value={form.birthday}
              onChange={(v) => onFormChange({ birthday: v })}
            />
            <div className="space-y-1.5">
              <Label>邀请码</Label>
              <Input
                value={form.inviteCode}
                onChange={(e) => onFormChange({ inviteCode: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>父级ID</Label>
              <Input
                value={form.parentId}
                onChange={(e) => onFormChange({ parentId: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
