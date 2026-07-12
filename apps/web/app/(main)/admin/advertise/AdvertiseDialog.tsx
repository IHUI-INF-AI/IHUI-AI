'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@ihui/ui'
import { ImageUpload } from '@/components/form/ImageUpload'
import type { Advertise, AdvertiseForm } from './types'

interface Props {
  open: boolean
  editing: Advertise | null
  form: AdvertiseForm
  setForm: React.Dispatch<React.SetStateAction<AdvertiseForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AdvertiseDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑广告' : '新增广告'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>标题</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="请输入标题"
            />
          </div>
          <div className="space-y-2">
            <Label>位置</Label>
            <Input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="请输入位置"
            />
          </div>
          <div className="space-y-2">
            <Label>图片</Label>
            <ImageUpload
              value={form.imageUrl}
              onChange={(v) => setForm({ ...form, imageUrl: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>链接</Label>
            <Input
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="请输入链接"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>排序</Label>
              <Input
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>启用</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
