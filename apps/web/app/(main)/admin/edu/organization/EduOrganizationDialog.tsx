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
import type { Organization, OrganizationForm } from './types'

interface Props {
  open: boolean
  editing: Organization | null
  form: OrganizationForm
  onFormChange: (patch: Partial<OrganizationForm>) => void
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function EduOrganizationDialog({
  open,
  editing,
  form,
  onFormChange,
  err,
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑组织' : '新建组织'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>UUID</Label>
              <Input value={form.uuid} onChange={(e) => onFormChange({ uuid: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>平台ID</Label>
              <Input
                value={form.platformId}
                onChange={(e) => onFormChange({ platformId: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>名称</Label>
            <Input value={form.name} onChange={(e) => onFormChange({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <textarea
              className={textareaCls}
              value={form.remark}
              onChange={(e) => onFormChange({ remark: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>文件路径</Label>
            <Input
              value={form.filePath}
              onChange={(e) => onFormChange({ filePath: e.target.value })}
              placeholder="文件URL"
            />
          </div>
          <div className="space-y-2">
            <Label>图片</Label>
            <ImageUpload
              value={form.binding}
              onChange={(v) => onFormChange({ binding: v as string })}
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
