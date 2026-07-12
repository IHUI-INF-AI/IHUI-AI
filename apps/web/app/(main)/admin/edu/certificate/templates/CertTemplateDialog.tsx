'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { textareaClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
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
import type { Template, TForm } from './types'

interface Props {
  open: boolean
  editing: Template | null
  form: TForm
  setForm: React.Dispatch<React.SetStateAction<TForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function CertTemplateDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.eduCertTemplate')
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
            <Label htmlFor="tpl-name">{t('labelName')}</Label>
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-desc">{t('labelDescription')}</Label>
            <textarea
              id="tpl-desc"
              className={textareaClass}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-bg">{t('labelBackgroundImage')}</Label>
            <Input
              id="tpl-bg"
              value={form.backgroundImage}
              onChange={(e) => setForm({ ...form, backgroundImage: e.target.value })}
              placeholder={t('placeholderBackgroundImage')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-config">{t('labelTemplateConfig')}</Label>
            <textarea
              id="tpl-config"
              className={cn(textareaClass, 'font-mono')}
              rows={4}
              value={form.templateConfig}
              onChange={(e) => setForm({ ...form, templateConfig: e.target.value })}
              placeholder='{"fields":["name","title"]}'
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="tpl-status"
              checked={form.status}
              onCheckedChange={(v) => setForm({ ...form, status: v })}
            />
            <Label htmlFor="tpl-status">{t('labelStatus')}</Label>
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
