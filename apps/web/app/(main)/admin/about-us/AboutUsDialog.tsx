'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
import { FIELDS, TEXTAREA_CLASS } from './helpers'
import type { AboutUsItem } from './types'

interface Props {
  open: boolean
  editing: AboutUsItem | null
  form: AboutUsItem
  setForm: React.Dispatch<React.SetStateAction<AboutUsItem>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AboutUsDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.aboutUs')
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
            <DialogTitle>{editing ? '编辑关于我们' : '新增关于我们'}</DialogTitle>
          </DialogHeader>
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={`f-${f.key}`}>{t(f.label)}</Label>
              {f.type === 'textarea' ? (
                <textarea
                  id={`f-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className={TEXTAREA_CLASS}
                  rows={3}
                  placeholder={`请输入${t(f.label)}`}
                />
              ) : (
                <Input
                  id={`f-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={`请输入${t(f.label)}`}
                />
              )}
            </div>
          ))}
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
