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
import type { UserAgentContext, UserAgentContextForm } from './types'

interface Props {
  open: boolean
  editing: UserAgentContext | null
  form: UserAgentContextForm
  setForm: React.Dispatch<React.SetStateAction<UserAgentContextForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function UserAgentContextDialog({
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
            <DialogTitle>{editing ? '编辑用户Agent上下文' : '新增用户Agent上下文'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>AgentID *</Label>
              <Input
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>用户UUID *</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>问题</Label>
            <Input
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>回答</Label>
            <Input
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>用户URL</Label>
            <Input
              value={form.userUrl}
              onChange={(e) => setForm({ ...form, userUrl: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>AgentURL</Label>
            <Input
              value={form.agentUrl}
              onChange={(e) => setForm({ ...form, agentUrl: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>发送时间</Label>
            <Input
              value={form.sendTime}
              onChange={(e) => setForm({ ...form, sendTime: e.target.value })}
              placeholder="yyyy-MM-dd"
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
