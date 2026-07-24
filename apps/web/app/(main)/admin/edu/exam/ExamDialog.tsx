'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
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
  Switch,
} from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import type { Paper, PaperForm } from './types'
import { ExamDialogFields } from './ExamDialogFields'

interface Props {
  open: boolean
  editing: Paper | null
  form: PaperForm
  onFormChange: (patch: Partial<PaperForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function ExamDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.exam.index')
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
            <DialogTitle>{editing ? t('dialogEditTitle') : t('dialogCreateTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="p-title">{t('fieldTitle')}</Label>
            <Input
              id="p-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">{t('fieldDescription')}</Label>
            <Input
              id="p-desc"
              value={form.description}
              onChange={(e) => onFormChange({ description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-total">{t('fieldTotalScore')}</Label>
              <Input
                id="p-total"
                type="number"
                min="0"
                value={form.totalScore}
                onChange={(e) => onFormChange({ totalScore: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-pass">{t('fieldPassScore')}</Label>
              <Input
                id="p-pass"
                type="number"
                min="0"
                value={form.passScore}
                onChange={(e) => onFormChange({ passScore: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-dur">{t('fieldDuration')}</Label>
              <Input
                id="p-dur"
                type="number"
                min="1"
                max="600"
                value={form.duration}
                onChange={(e) => onFormChange({ duration: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-pub">{t('fieldPublishStatus')}</Label>
              <Select
                value={form.isPublished ? 'true' : 'false'}
                onValueChange={(v) => onFormChange({ isPublished: v === 'true' })}
              >
                <SelectTrigger className={selectClass} id="p-pub">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">{t('status.unpublished')}</SelectItem>
                  <SelectItem value="true">{t('status.published')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-rand">{t('random')}</Label>
              <Select
                value={form.isRandom ? 'true' : 'false'}
                onValueChange={(v) => onFormChange({ isRandom: v === 'true' })}
              >
                <SelectTrigger className={selectClass} id="p-rand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">{t('no')}</SelectItem>
                  <SelectItem value="true">{t('yes')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="p-status"
              checked={form.status}
              onCheckedChange={(v) => onFormChange({ status: v })}
            />
            <Label htmlFor="p-status">{t('fieldEnabled')}</Label>
          </div>
          <ExamDialogFields form={form} onFormChange={onFormChange} />
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
