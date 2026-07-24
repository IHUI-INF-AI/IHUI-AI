'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { selectClass, textareaClass, STATUS_OPTS } from './helpers'
import type { AdminProject, ProjectForm } from './types'

interface Props {
  open: boolean
  editing: AdminProject | null
  form: ProjectForm
  onFormChange: (patch: Partial<ProjectForm>) => void
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ProjectDialog({
  open,
  editing,
  form,
  onFormChange,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.projects')
  const tc = useTranslations('common')

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
            <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          {!editing && (
            <div className="space-y-2">
              <Label htmlFor="p-userId">{t('fieldUserId')}</Label>
              <Input
                id="p-userId"
                value={form.userId}
                onChange={(e) => onFormChange({ userId: e.target.value })}
                placeholder={t('userIdPlaceholder')}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="p-name">{t('fieldName')}</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">{t('fieldDescription')}</Label>
            <textarea
              id="p-desc"
              value={form.description}
              onChange={(e) => onFormChange({ description: e.target.value })}
              placeholder={t('descPlaceholder')}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-status">{t('fieldStatus')}</Label>
            <Select
              value={String(form.status)}
              onValueChange={(v) => onFormChange({ status: Number(v) })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {t(`status_${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
