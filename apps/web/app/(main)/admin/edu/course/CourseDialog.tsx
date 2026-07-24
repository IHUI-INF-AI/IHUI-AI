'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { ImageUpload } from '@/components/form/ImageUpload'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
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
import { useTranslations } from 'next-intl'
import type { Course, CForm } from './types'

interface Props {
  open: boolean
  editing: Course | null
  form: CForm
  onFormChange: (patch: Partial<CForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function CourseDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.course.index')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('dialogEditTitle') : t('dialogCreateTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-title">{t('fieldTitle')}</Label>
              <Input
                id="c-title"
                value={form.title}
                onChange={(e) => onFormChange({ title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-subtitle">{t('fieldSubtitle')}</Label>
              <Input
                id="c-subtitle"
                value={form.subtitle}
                onChange={(e) => onFormChange({ subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-stage">{t('fieldStage')}</Label>
              <Select value={form.stage} onValueChange={(v) => onFormChange({ stage: v })}>
                <SelectTrigger className={selectClass} id="c-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('stage.0')}</SelectItem>
                  <SelectItem value="1">{t('stage.1')}</SelectItem>
                  <SelectItem value="2">{t('stage.2')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-label">{t('fieldLabel')}</Label>
              <Input
                id="c-label"
                value={form.label}
                onChange={(e) => onFormChange({ label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-remarkFile">{t('fieldRemarkFile')}</Label>
              <Input
                id="c-remarkFile"
                value={form.remarkFile}
                onChange={(e) => onFormChange({ remarkFile: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-creator">{t('fieldCreator')}</Label>
              <Input
                id="c-creator"
                value={form.creator}
                onChange={(e) => onFormChange({ creator: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-remark">{t('fieldRemark')}</Label>
            <textarea
              id="c-remark"
              value={form.remark}
              onChange={(e) => onFormChange({ remark: e.target.value })}
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldCover')}</Label>
            <ImageUpload
              value={form.binding}
              onChange={(v) => onFormChange({ binding: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldContent')}</Label>
            <RichTextEditor
              value={form.content}
              onChange={(html) => onFormChange({ content: html })}
              placeholder={t('contentPlaceholder')}
            />
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
