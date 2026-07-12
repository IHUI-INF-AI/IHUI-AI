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
import type { ZhsAgent, ZhsAgentForm } from './types'

interface Props {
  open: boolean
  editing: ZhsAgent | null
  form: ZhsAgentForm
  setForm: React.Dispatch<React.SetStateAction<ZhsAgentForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ZhsAgentDialog({
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑ZHS Agent' : '新增ZHS Agent'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>名称 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>图片</Label>
            <ImageUpload
              value={form.image}
              onChange={(v) => setForm({ ...form, image: v as string })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>消耗</Label>
              <Input
                value={form.consume}
                onChange={(e) => setForm({ ...form, consume: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input
                type="number"
                value={form.seqencing}
                onChange={(e) => setForm({ ...form, seqencing: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>价格</Label>
              <Input
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>热度</Label>
              <Input
                value={form.heat}
                onChange={(e) => setForm({ ...form, heat: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>信息</Label>
            <Input value={form.info} onChange={(e) => setForm({ ...form, info: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
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
