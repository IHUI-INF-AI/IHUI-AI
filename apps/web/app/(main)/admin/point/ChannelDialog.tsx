'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
import type { Channel, ChannelForm } from './types'

interface Props {
  open: boolean
  editing: Channel | null
  form: ChannelForm
  setForm: React.Dispatch<React.SetStateAction<ChannelForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ChannelDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.point')
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
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ch-name">{t('fieldName')}</Label>
            <Input
              id="ch-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-code">{t('fieldCode')}</Label>
            <Input
              id="ch-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder={t('codePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-desc">{t('fieldDescription')}</Label>
            <Input
              id="ch-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-sort">{t('fieldSort')}</Label>
              <Input
                id="ch-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-status">{t('fieldStatus')}</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="ch-status"
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.status ? t('enabled') : t('disabled')}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
