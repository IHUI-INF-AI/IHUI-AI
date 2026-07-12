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
import type { AuthFindInfo, AuthFindInfoForm } from './types'

interface DialogProps {
  open: boolean
  editing: AuthFindInfo | null
  form: AuthFindInfoForm
  onFormChange: (patch: Partial<AuthFindInfoForm>) => void
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthFindInfoDialog({
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
            <DialogTitle>{editing ? '编辑用户资金账号' : '新增用户资金账号'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改用户资金账号信息' : '添加新的用户资金账号'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>用户UUID *</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => onFormChange({ userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>银行卡号 *</Label>
              <Input value={form.card} onChange={(e) => onFormChange({ card: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>所属银行 *</Label>
              <Input
                value={form.belong}
                onChange={(e) => onFormChange({ belong: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>标题</Label>
              <Input value={form.title} onChange={(e) => onFormChange({ title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>消息</Label>
              <Input
                value={form.message}
                onChange={(e) => onFormChange({ message: e.target.value })}
              />
            </div>
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

interface DeleteDialogProps {
  delId: string | null
  deletePending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AuthFindInfoDeleteDialog({
  delId,
  deletePending,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  return (
    <Dialog
      open={delId !== null}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>确定要删除该用户资金账号记录吗？此操作不可撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={deletePending}>
            取消
          </Button>
          <Button type="button" variant="destructive" disabled={deletePending} onClick={onConfirm}>
            {deletePending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
