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
import type { DeveloperLink, DeveloperLinkForm } from './types'

interface Props {
  open: boolean
  editing: DeveloperLink | null
  form: DeveloperLinkForm
  setForm: React.Dispatch<React.SetStateAction<DeveloperLinkForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function DeveloperLinkDialog({
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
      <DialogContent className="max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑开发者链接' : '新增开发者链接'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>开发者 ID</Label>
            <Input
              value={form.developerId}
              onChange={(e) => setForm({ ...form, developerId: e.target.value })}
              placeholder="请输入开发者 ID"
            />
          </div>
          <div className="space-y-2">
            <Label>Agent ID</Label>
            <Input
              value={form.agentId}
              onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              placeholder="请输入 Agent ID"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.status}
              onCheckedChange={(v) => setForm({ ...form, status: v })}
            />
            <Label>启用</Label>
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
