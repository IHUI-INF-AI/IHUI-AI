'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
import { ImageUpload } from '@/components/form/ImageUpload'
import { STATUS_OPTIONS, PRIORITY_OPTIONS, selectClass, textareaClass, inputSm } from './helpers'
import type { AdminFeedbackItem, EditForm, CreateForm } from './types'

interface FeedbackEditDialogProps {
  open: boolean
  editing: AdminFeedbackItem | null
  form: EditForm
  err: string | null
  isPending: boolean
  onFormChange: (form: EditForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function FeedbackEditDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: FeedbackEditDialogProps) {
  const t = useTranslations('admin.feedbacks')
  const tf = useTranslations('feedback')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
            <DialogDescription>{t('editDesc')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          {editing && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{editing.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {editing.user ?? '-'} · {tf(`type_${editing.type}`)}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fb-status">{tf('field_status')}</Label>
            <Select
              value={form.status}
              onValueChange={(v) => onFormChange({ ...form, status: v as EditForm['status'] })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tf(`status_${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-priority">{tf('field_priority')}</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => onFormChange({ ...form, priority: v as EditForm['priority'] })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {tf(`priority_${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-reply">{t('fieldReply')}</Label>
            <textarea
              id="fb-reply"
              value={form.adminReply}
              onChange={(e) => onFormChange({ ...form, adminReply: e.target.value })}
              placeholder={t('replyPlaceholder')}
              rows={4}
              className={textareaClass}
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

interface FeedbackCreateDialogProps {
  open: boolean
  form: CreateForm
  err: string | null
  isPending: boolean
  onFormChange: (form: CreateForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function FeedbackCreateDialog({
  open,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: FeedbackCreateDialogProps) {
  const t = useTranslations('admin.feedbacks')
  const tc = useTranslations('common')

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
            <Label>{t('fieldTitle')} *</Label>
            <Input
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder={t('titlePlaceholder')}
              className={inputSm}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldContent')}</Label>
            <textarea
              value={form.context}
              onChange={(e) => onFormChange({ ...form, context: e.target.value })}
              placeholder={t('contentPlaceholder')}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldImage')}</Label>
            <ImageUpload
              value={form.filePath}
              onChange={(v) =>
                onFormChange({ ...form, filePath: Array.isArray(v) ? (v[0] ?? '') : v })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldIsDel')}</Label>
            <Select value={form.isDel} onValueChange={(v) => onFormChange({ ...form, isDel: v })}>
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('isDelNormal')}</SelectItem>
                <SelectItem value="1">{t('isDelDeleted')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('fieldFeedback')}</Label>
            <textarea
              value={form.feedback}
              onChange={(e) => onFormChange({ ...form, feedback: e.target.value })}
              placeholder={t('feedbackPlaceholder')}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldFeedbackImage')}</Label>
            <ImageUpload
              value={form.feedbackPath}
              onChange={(v) =>
                onFormChange({
                  ...form,
                  feedbackPath: Array.isArray(v) ? (v[0] ?? '') : v,
                })
              }
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
