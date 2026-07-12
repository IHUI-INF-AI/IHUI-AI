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
import type { AuthDept, AuthDeptForm } from './types'

interface EditProps {
  open: boolean
  editing: AuthDept | null
  form: AuthDeptForm
  setForm: React.Dispatch<React.SetStateAction<AuthDeptForm>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AuthDeptDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: EditProps) {
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
            <DialogTitle>{editing ? '编辑用户部门关联' : '新增用户部门关联'}</DialogTitle>
            <DialogDescription>
              {editing ? '修改用户部门关联信息' : '添加新的用户部门关联'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>用户ID *</Label>
              <Input
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>部门ID *</Label>
              <Input
                value={form.deptId}
                onChange={(e) => setForm({ ...form, deptId: e.target.value })}
              />
            </div>
            <DatePicker
              label="创建时间"
              value={form.createdAt}
              onChange={(v) => setForm({ ...form, createdAt: v })}
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
  delId: string | null
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AuthDeptDeleteDialog({ delId, pending, onCancel, onConfirm }: DeleteProps) {
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
          <DialogDescription>确定要删除该用户部门关联记录吗？此操作不可撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
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
