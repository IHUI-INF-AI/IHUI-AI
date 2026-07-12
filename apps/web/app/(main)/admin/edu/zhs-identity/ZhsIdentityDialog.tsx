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
} from '@ihui/ui'
import { ImageUpload } from '@/components/form/ImageUpload'
import { textareaCls } from './helpers'
import type { ZhsIdentity, CForm } from './types'

interface Props {
  open: boolean
  editing: ZhsIdentity | null
  form: CForm
  setForm: React.Dispatch<React.SetStateAction<CForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ZhsIdentityDialog({
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
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑平台身份' : '新建平台身份'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>UUID</Label>
              <Input
                value={form.uuid}
                onChange={(e) => setForm({ ...form, uuid: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>平台ID</Label>
              <Input
                value={form.platformId}
                onChange={(e) => setForm({ ...form, platformId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>组织ID</Label>
              <Input
                value={form.organizationId}
                onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>父级ID</Label>
              <Input
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>是否跨组织</Label>
              <Input
                type="number"
                value={form.isCross}
                onChange={(e) => setForm({ ...form, isCross: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <textarea
              className={textareaCls}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>图片</Label>
            <ImageUpload
              value={form.binding}
              onChange={(v) => setForm({ ...form, binding: v as string })}
            />
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
