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
import { FIELDS } from './helpers'
import type { ZhsUser } from './types'

interface Props {
  open: boolean
  editing: ZhsUser | null
  form: Record<string, string>
  onFormChange: (patch: Record<string, string>) => void
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ZhsUserDialog({
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
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑ZHS用户' : '新增ZHS用户'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>
                  {f.label}
                  {f.required && ' *'}
                </Label>
                <Input
                  value={form[f.key]}
                  onChange={(e) => onFormChange({ [f.key]: e.target.value })}
                />
              </div>
            ))}
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
