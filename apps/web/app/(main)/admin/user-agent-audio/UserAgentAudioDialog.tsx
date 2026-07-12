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
import type { UserAgentAudio, UserAgentAudioForm } from './types'

interface Props {
  open: boolean
  editing: UserAgentAudio | null
  form: UserAgentAudioForm
  setForm: React.Dispatch<React.SetStateAction<UserAgentAudioForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function UserAgentAudioDialog({
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
            <DialogTitle>{editing ? '编辑用户Agent音频' : '新增用户Agent音频'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>用户UUID *</Label>
              <Input
                value={form.uuid}
                onChange={(e) => setForm({ ...form, uuid: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>音频ID</Label>
              <Input
                value={form.audioId}
                onChange={(e) => setForm({ ...form, audioId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>AgentID</Label>
              <Input
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>来源</Label>
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>平台</Label>
              <Input
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>音频路径</Label>
            <Input
              value={form.audioPath}
              onChange={(e) => setForm({ ...form, audioPath: e.target.value })}
              placeholder="请输入音频URL"
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
