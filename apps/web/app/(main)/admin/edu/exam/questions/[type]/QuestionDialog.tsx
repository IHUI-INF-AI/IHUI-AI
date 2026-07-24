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
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { textareaClass } from '@/lib/edu'
import type { Question, QForm } from './types'

interface Props {
  open: boolean
  editing: Question | null
  form: QForm
  setForm: React.Dispatch<React.SetStateAction<QForm>>
  err: string | null
  saving: boolean
  label: string
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function QuestionDialog({
  open,
  editing,
  form,
  setForm,
  err,
  saving,
  label,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.edu.exam.questionsType')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('editWithType', { type: label }) : t('createWithType', { type: label })}
            </DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="t-title">{t('stem')}</Label>
            <textarea
              id="t-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              rows={2}
              className={cn(textareaClass, 'font-sans')}
              placeholder={t('stemPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-score">{t('score')}</Label>
              <Input
                id="t-score"
                type="number"
                min="0"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-sort">{t('sort')}</Label>
              <Input
                id="t-sort"
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-options">{t('optionsJson')}</Label>
              <textarea
                id="t-options"
                value={form.options}
                onChange={(e) => setForm({ ...form, options: e.target.value })}
                rows={4}
                className={textareaClass}
                placeholder={t('optionsPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-answer">{t('answerJson')}</Label>
              <textarea
                id="t-answer"
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                rows={4}
                className={textareaClass}
                placeholder='"A" / ["A","B"] / true'
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-analysis">{t('analysis')}</Label>
            <Input
              id="t-analysis"
              value={form.analysis}
              onChange={(e) => setForm({ ...form, analysis: e.target.value })}
              placeholder={t('analysisPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
