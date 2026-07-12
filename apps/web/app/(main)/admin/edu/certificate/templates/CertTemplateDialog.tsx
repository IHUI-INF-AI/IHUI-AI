'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { textareaClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
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
import type { Template, TForm } from './types'

interface Props {
  open: boolean
  editing: Template | null
  form: TForm
  setForm: React.Dispatch<React.SetStateAction<TForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function CertTemplateDialog({
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
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑模板' : '新建模板'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="tpl-name">名称</Label>
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-desc">描述</Label>
            <textarea
              id="tpl-desc"
              className={textareaClass}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-bg">背景图片</Label>
            <Input
              id="tpl-bg"
              value={form.backgroundImage}
              onChange={(e) => setForm({ ...form, backgroundImage: e.target.value })}
              placeholder="背景图片URL（选填）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-config">模板配置 (JSON)</Label>
            <textarea
              id="tpl-config"
              className={cn(textareaClass, 'font-mono')}
              rows={4}
              value={form.templateConfig}
              onChange={(e) => setForm({ ...form, templateConfig: e.target.value })}
              placeholder='{"fields":["name","title"]}'
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="tpl-status"
              checked={form.status}
              onCheckedChange={(v) => setForm({ ...form, status: v })}
            />
            <Label htmlFor="tpl-status">启用</Label>
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
