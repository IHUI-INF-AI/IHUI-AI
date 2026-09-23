// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Checkbox,
} from '@ihui/ui-react'
import { type PlanItem, type PlanItemFormData, emptyItemForm } from './types'

export function PlanItemEditDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
  isStudentMode,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: PlanItem | null
  onSave: (data: PlanItemFormData) => Promise<void>
  onDelete?: () => Promise<void>
  isStudentMode?: boolean
}) {
  const t = useTranslations('eduStudyPlan')
  const [form, setForm] = React.useState<PlanItemFormData>(emptyItemForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        content: initial.content,
        objective: initial.objective ?? '',
        dueDate: initial.dueDate ?? '',
        notes: initial.notes ?? '',
        completed: initial.completed,
      })
    } else {
      setForm(emptyItemForm)
    }
  }, [initial, open])

  const update = (key: keyof PlanItemFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.content.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isStudentMode ? t('addNotes') : initial ? t('editItemTitle') : t('addItemTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>{t('content')}</Label>
            <Input
              value={form.content}
              onChange={(e) => update('content', e.target.value)}
              placeholder={t('contentPlaceholder')}
              disabled={isStudentMode && !!initial}
            />
          </div>
          {!isStudentMode && (
            <div className="grid gap-1.5">
              <Label>{t('objective')}</Label>
              <Input
                value={form.objective}
                onChange={(e) => update('objective', e.target.value)}
                placeholder={t('objectiveFieldPlaceholder')}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>{t('dueDate')}</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => update('dueDate', e.target.value)}
              disabled={isStudentMode && !!initial}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder={isStudentMode ? t('addYourNotes') : t('notesPlaceholder')}
            />
          </div>
          {initial && (
            <label htmlFor="item-completed" className="flex items-center gap-2 text-sm">
              <Checkbox
                id="item-completed"
                checked={form.completed}
                onCheckedChange={(checked) => update('completed', checked as boolean)}
              />
              <span>{t('statusCompleted')}</span>
            </label>
          )}
        </div>
        <DialogFooter>
          {initial && onDelete && !isStudentMode && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t('delete')}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !form.content.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isStudentMode ? t('saveNotes') : initial ? t('save') : t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
