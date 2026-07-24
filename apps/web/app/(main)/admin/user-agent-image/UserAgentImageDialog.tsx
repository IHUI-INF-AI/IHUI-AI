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
} from '@ihui/ui-react'
import { ImageUpload } from '@/components/form/ImageUpload'
import type { UserAgentImage, UserAgentImageForm } from './types'

interface Props {
  open: boolean
  editing: UserAgentImage | null
  form: UserAgentImageForm
  onFormChange: (patch: Partial<UserAgentImageForm>) => void
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function UserAgentImageDialog({
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
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑用户Agent图片' : '新增用户Agent图片'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>用户UUID *</Label>
            <Input
              value={form.userUuid}
              onChange={(e) => onFormChange({ userUuid: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>图片</Label>
            <ImageUpload
              value={form.imagePath}
              onChange={(v) => onFormChange({ imagePath: v as string })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>图片名称</Label>
              <Input
                value={form.imageName}
                onChange={(e) => onFormChange({ imageName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <Input value={form.type} onChange={(e) => onFormChange({ type: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>平台</Label>
              <Input
                value={form.platform}
                onChange={(e) => onFormChange({ platform: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input
                value={form.modelName}
                onChange={(e) => onFormChange({ modelName: e.target.value })}
              />
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
