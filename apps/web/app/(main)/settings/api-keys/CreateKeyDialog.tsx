'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
} from '@ihui/ui-react'
import { PermissionSelector } from './PermissionSelector'
import type { CreateFormState } from './types'

interface Props {
  open: boolean
  form: CreateFormState
  isPending: boolean
  onFormChange: (f: CreateFormState) => void
  onClose: () => void
  onSubmit: () => void
}

export function CreateKeyDialog({
  open,
  form,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: Props) {
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : !isPending && onClose())}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.name.trim()) {
              toast.error('请输入密钥名称')
              return
            }
            if (form.permissions.length === 0) {
              toast.error('请至少选择一个权限')
              return
            }
            onSubmit()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>创建 API 密钥</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ak-name">密钥名称</Label>
            <Input
              id="ak-name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="例如:生产环境调用密钥"
            />
          </div>
          <div className="space-y-2">
            <Label>权限范围</Label>
            <PermissionSelector
              value={form.permissions}
              onChange={(p) => onFormChange({ ...form, permissions: p })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ak-rate">速率限制(次/分钟)</Label>
            <Input
              id="ak-rate"
              type="number"
              min={1}
              value={form.rateLimit}
              onChange={(e) => onFormChange({ ...form, rateLimit: Number(e.target.value) || 0 })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
