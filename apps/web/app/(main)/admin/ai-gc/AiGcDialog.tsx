'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { ImageUpload } from '@/components/form/ImageUpload'
import { TEXT_FIELDS, textareaClass } from './helpers'
import type { AiGcItem } from './types'

interface Props {
  open: boolean
  editing: AiGcItem | null
  form: AiGcItem
  setForm: React.Dispatch<React.SetStateAction<AiGcItem>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AiGcDialog({
  open,
  editing,
  form,
  setForm,
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
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑AIGC' : '新增AIGC'}</DialogTitle>
          </DialogHeader>
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
              {f.type === 'textarea' ? (
                <textarea
                  id={`f-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className={textareaClass}
                  rows={2}
                  placeholder={`请输入${f.label}`}
                />
              ) : (
                <Input
                  id={`f-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={`请输入${f.label}`}
                />
              )}
            </div>
          ))}
          <div className="space-y-2">
            <Label>封面图</Label>
            <ImageUpload
              value={form.coverUrl}
              onChange={(v) =>
                setForm({ ...form, coverUrl: typeof v === 'string' ? v : (v[0] ?? '') })
              }
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
