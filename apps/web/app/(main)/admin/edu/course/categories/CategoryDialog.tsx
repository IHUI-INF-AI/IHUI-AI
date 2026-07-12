'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { ImageUpload } from '@/components/form/ImageUpload'
import { selectClass } from '@/lib/edu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import type { Category, CForm } from './types'

interface Props {
  open: boolean
  editing: Category | null
  form: CForm
  onFormChange: (patch: Partial<CForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function CategoryDialog({
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
            <DialogTitle>{editing ? '编辑分类字典' : '新建分类字典'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cd-code">编码 *</Label>
              <Input
                id="cd-code"
                value={form.code}
                onChange={(e) => onFormChange({ code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-name">名称</Label>
              <Input
                id="cd-name"
                value={form.name}
                onChange={(e) => onFormChange({ name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-prentId">父ID</Label>
              <Input
                id="cd-prentId"
                value={form.prentId}
                onChange={(e) => onFormChange({ prentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-typeId">类型ID *</Label>
              <Input
                id="cd-typeId"
                value={form.typeId}
                onChange={(e) => onFormChange({ typeId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-sort">排序</Label>
              <Input
                id="cd-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => onFormChange({ sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-isInvalid">是否失效</Label>
              <Select value={form.isInvalid} onValueChange={(v) => onFormChange({ isInvalid: v })}>
                <SelectTrigger className={selectClass} id="cd-isInvalid">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">有效</SelectItem>
                  <SelectItem value="1">失效</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>图片</Label>
            <ImageUpload value={form.img} onChange={(v) => onFormChange({ img: v as string })} />
          </div>
          <div className="space-y-2">
            <Label>按钮图</Label>
            <ImageUpload
              value={form.butImg}
              onChange={(v) => onFormChange({ butImg: v as string })}
            />
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
