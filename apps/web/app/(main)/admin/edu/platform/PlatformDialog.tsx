'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ImageUpload } from '@/components/form/ImageUpload'
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
} from '@ihui/ui-react'
import { textareaCls } from './helpers'
import type { EduPlatform, CForm } from './types'

interface Props {
  open: boolean
  editing: EduPlatform | null
  form: CForm
  onFormChange: (patch: Partial<CForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function PlatformDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.platform')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('codeLabel')}</Label>
              <Input value={form.code} onChange={(e) => onFormChange({ code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('nameLabel')}</Label>
              <Input value={form.name} onChange={(e) => onFormChange({ name: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('domainLabel')}</Label>
            <Input value={form.domain} onChange={(e) => onFormChange({ domain: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('remarkLabel')}</Label>
            <textarea
              className={textareaCls}
              value={form.remark}
              onChange={(e) => onFormChange({ remark: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('imageLabel')}</Label>
            <ImageUpload
              value={form.binding}
              onChange={(v) => onFormChange({ binding: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('filePathLabel')}</Label>
            <Input
              value={form.filePath}
              onChange={(e) => onFormChange({ filePath: e.target.value })}
              placeholder={t('filePathPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t('typeLabel')}</Label>
              <Input
                type="number"
                value={form.type}
                onChange={(e) => onFormChange({ type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('sortLabel')}</Label>
              <Input
                type="number"
                value={form.sort}
                onChange={(e) => onFormChange({ sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('statusLabel')}</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={form.status}
                  onCheckedChange={(v) => onFormChange({ status: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.status ? t('statusEnabled') : t('statusDisabled')}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('extField1')}</Label>
              <Input
                value={form.field1}
                onChange={(e) => onFormChange({ field1: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('extField2')}</Label>
              <Input
                value={form.field2}
                onChange={(e) => onFormChange({ field2: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
