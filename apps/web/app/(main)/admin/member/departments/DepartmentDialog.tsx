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
} from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'
import { FIELDS, DATE_FIELDS } from './helpers'
import type { Department, FormState } from './types'

interface Props {
  open: boolean
  editing: Department | null
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function DepartmentDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑用户部门' : '新增用户部门'}</DialogTitle>
            <DialogDescription>{editing ? '修改用户部门' : '添加新的用户部门'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>
                  {f.label}
                  {f.required ? ' *' : ''}
                </Label>
                <Input
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
            {DATE_FIELDS.map((d) => (
              <DatePicker
                key={d.key}
                label={d.label}
                value={form[d.key]}
                onChange={(v) => setForm({ ...form, [d.key]: v })}
              />
            ))}
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
  delPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DepartmentDeleteDialog({ open, delPending, onConfirm, onCancel }: DeleteProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>确定要删除该记录吗？此操作不可撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={delPending}>
            取消
          </Button>
          <Button type="button" variant="destructive" disabled={delPending} onClick={onConfirm}>
            {delPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
