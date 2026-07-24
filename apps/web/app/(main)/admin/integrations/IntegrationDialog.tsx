'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { PROVIDERS, selectClass, textareaClass } from './helpers'
import type { Integration, IntegrationForm, Provider } from './types'

interface Props {
  open: boolean
  editing: Integration | null
  form: IntegrationForm
  setForm: React.Dispatch<React.SetStateAction<IntegrationForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  delTarget: Integration | null
  delPending: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

export function IntegrationDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
  delTarget,
  delPending,
  onConfirmDelete,
  onCancelDelete,
}: Props) {
  const t = useTranslations('admin.integrations')
  const tc = useTranslations('common')
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose()
        }}
      >
        <DialogContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
              <DialogDescription>{t('createDesc')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="i-name">{t('fieldName')}</Label>
              <Input
                id="i-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-provider">{t('fieldProvider')}</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as Provider })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`providers.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-cred">{t('fieldCredentials')}</Label>
              <textarea
                id="i-cred"
                value={form.credentials}
                onChange={(e) => setForm({ ...form, credentials: e.target.value })}
                placeholder={'{\n  "apiKey": "..."\n}'}
                rows={6}
                className={textareaClass}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              {t('fieldEnabled')}
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={savePending}>
                {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!delTarget}
        onOpenChange={(o) => {
          if (!o && !delPending) onCancelDelete()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          {delTarget && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{delTarget.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t(`providers.${delTarget.provider}`)}
              </div>
            </div>
          )}
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancelDelete} disabled={delPending}>
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delPending}
              onClick={onConfirmDelete}
            >
              {delPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
