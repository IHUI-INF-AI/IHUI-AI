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
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { ApiApp, ApiAppForm } from './types'

interface CreateProps {
  open: boolean
  form: ApiAppForm
  setForm: React.Dispatch<React.SetStateAction<ApiAppForm>>
  err: string | null
  createPending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ApiAppCreateDialog({
  open,
  form,
  setForm,
  err,
  createPending,
  onSubmit,
  onClose,
}: CreateProps) {
  const t = useTranslations('adminApiApps')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDesc')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ap-name">{t('labelName')}</Label>
            <Input
              id="ap-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('phName')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-perms">{t('labelPermissions')}</Label>
            <Input
              id="ap-perms"
              value={form.permissions}
              onChange={(e) => setForm({ ...form, permissions: e.target.value })}
              placeholder={t('phPermissions')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={createPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createPending}>
              {createPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface CreatedProps {
  created: ApiApp | null
  onClose: () => void
}

export function ApiAppCreatedDialog({ created, onClose }: CreatedProps) {
  const t = useTranslations('adminApiApps')
  return (
    <Dialog open={!!created} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createdTitle')}</DialogTitle>
          <DialogDescription>{t('createdDesc')}</DialogDescription>
        </DialogHeader>
        {created && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('labelAppId')}</Label>
              <code className="block rounded-md bg-muted/50 px-3 py-2 text-xs">
                {created.appId}
              </code>
            </div>
            <div className="space-y-1">
              <Label>{t('labelAppSecret')}</Label>
              <code className={cn('block rounded-md bg-amber-500/10 px-3 py-2 text-xs')}>
                {created.appSecret}
              </code>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteProps {
  delTarget: ApiApp | null
  err: string | null
  delPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ApiAppDeleteDialog({
  delTarget,
  err,
  delPending,
  onConfirm,
  onCancel,
}: DeleteProps) {
  const t = useTranslations('adminApiApps')
  return (
    <Dialog open={!!delTarget} onOpenChange={(o) => (o ? null : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteDesc')}</DialogDescription>
        </DialogHeader>
        {err && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{delTarget?.name}</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={delPending}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={delPending} onClick={onConfirm}>
            {delPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
