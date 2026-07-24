'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ImageUpload } from '@/components/form/ImageUpload'
import { selectClass } from '@/lib/edu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import type { Category, CForm } from './types'

interface Props {
  open: boolean
  editing: Category | null
  form: CForm
  onFormChange: (patch: Partial<CForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function CategoryDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.course.categories')
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
            <DialogTitle>{editing ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cd-code">{t('dialog.codeRequired')}</Label>
              <Input
                id="cd-code"
                value={form.code}
                onChange={(e) => onFormChange({ code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-name">{t('dialog.name')}</Label>
              <Input
                id="cd-name"
                value={form.name}
                onChange={(e) => onFormChange({ name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-prentId">{t('dialog.prentId')}</Label>
              <Input
                id="cd-prentId"
                value={form.prentId}
                onChange={(e) => onFormChange({ prentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-typeId">{t('dialog.typeIdRequired')}</Label>
              <Input
                id="cd-typeId"
                value={form.typeId}
                onChange={(e) => onFormChange({ typeId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-sort">{t('dialog.sort')}</Label>
              <Input
                id="cd-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => onFormChange({ sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-isInvalid">{t('dialog.isInvalid')}</Label>
              <Select value={form.isInvalid} onValueChange={(v) => onFormChange({ isInvalid: v })}>
                <SelectTrigger className={selectClass} id="cd-isInvalid">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('dialog.valid')}</SelectItem>
                  <SelectItem value="1">{t('dialog.invalid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('dialog.image')}</Label>
            <ImageUpload value={form.img} onChange={(v) => onFormChange({ img: v as string })} />
          </div>
          <div className="space-y-2">
            <Label>{t('dialog.buttonImage')}</Label>
            <ImageUpload
              value={form.butImg}
              onChange={(v) => onFormChange({ butImg: v as string })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('dialog.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('dialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
