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
import type { AuthAccount, AuthAccountForm } from './types'

interface AuthAccountEditDialogProps {
  open: boolean
  editing: AuthAccount | null
  form: AuthAccountForm
  isPending: boolean
  onFormChange: (form: AuthAccountForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function AuthAccountEditDialog({
  open,
  editing,
  form,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: AuthAccountEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑第三方账号' : '新增第三方账号'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改第三方账号关联信息' : '添加新的第三方账号关联'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>用户UUID *</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => onFormChange({ ...form, userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>平台 *</Label>
              <Input
                value={form.platform}
                onChange={(e) => onFormChange({ ...form, platform: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>OpenID *</Label>
              <Input
                value={form.openId}
                onChange={(e) => onFormChange({ ...form, openId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>平台名称</Label>
              <Input
                value={form.platformName}
                onChange={(e) => onFormChange({ ...form, platformName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>AccessToken</Label>
              <Input
                value={form.accessToken}
                onChange={(e) => onFormChange({ ...form, accessToken: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>RefreshToken</Label>
              <Input
                value={form.refreshToken}
                onChange={(e) => onFormChange({ ...form, refreshToken: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>昵称</Label>
              <Input
                value={form.nickname}
                onChange={(e) => onFormChange({ ...form, nickname: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>头像</Label>
              <Input
                value={form.avatar}
                onChange={(e) => onFormChange({ ...form, avatar: e.target.value })}
              />
            </div>
            <DatePicker
              label="过期时间"
              value={form.expiresAt}
              onChange={(v) => onFormChange({ ...form, expiresAt: v })}
            />
            <DatePicker
              label="绑定时间"
              value={form.bindTime}
              onChange={(v) => onFormChange({ ...form, bindTime: v })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface AuthAccountDeleteDialogProps {
  delId: string | null
  isPending: boolean
  onClose: () => void
  onConfirm: (id: string) => void
}

export function AuthAccountDeleteDialog({
  delId,
  isPending,
  onClose,
  onConfirm,
}: AuthAccountDeleteDialogProps) {
  return (
    <Dialog
      open={delId !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>确定要删除该第三方账号记录吗？此操作不可撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => delId && onConfirm(delId)}
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
