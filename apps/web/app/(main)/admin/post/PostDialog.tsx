'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { inputCls, textareaCls } from './helpers'
import type { PostForm } from './types'

interface PostDialogProps {
  open: boolean
  editing: boolean
  form: PostForm
  err: string | null
  isPending: boolean
  onFormChange: (form: PostForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function PostDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: PostDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑岗位' : '新增岗位'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="p-name">岗位名称</Label>
            <Input
              id="p-name"
              value={form.postName}
              onChange={(e) => onFormChange({ ...form, postName: e.target.value })}
              placeholder="岗位名称"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-code">岗位编码</Label>
            <Input
              id="p-code"
              value={form.postCode}
              onChange={(e) => onFormChange({ ...form, postCode: e.target.value })}
              placeholder="岗位编码"
              disabled={editing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-sort">排序</Label>
            <Input
              id="p-sort"
              type="number"
              value={form.postSort}
              onChange={(e) => onFormChange({ ...form, postSort: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select
              value={String(form.status)}
              onValueChange={(v) => onFormChange({ ...form, status: Number(v) })}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">正常</SelectItem>
                <SelectItem value="1">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-remark">备注</Label>
            <textarea
              id="p-remark"
              value={form.remark}
              onChange={(e) => onFormChange({ ...form, remark: e.target.value })}
              rows={2}
              className={textareaCls}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
