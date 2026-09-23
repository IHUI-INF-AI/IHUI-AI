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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@ihui/ui-react'
import {
  type StudyPlan,
  type Term,
  type EduClass,
  type PlanType,
  type StudyPlanFormData,
  emptyPlanForm,
} from './types'

export function StudyPlanEditDialog({
  open,
  onOpenChange,
  initial,
  selectedTermId,
  selectedClassId,
  terms,
  classes,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: StudyPlan | null
  selectedTermId: string
  selectedClassId: string
  terms: Term[]
  classes: EduClass[]
  onSave: (data: StudyPlanFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const t = useTranslations('eduStudyPlan')
  const [form, setForm] = React.useState<StudyPlanFormData>(emptyPlanForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        planType: initial.planType,
        classId: initial.classId,
        termId: initial.termId,
        startDate: initial.startDate,
        endDate: initial.endDate,
        description: initial.description ?? '',
      })
    } else {
      setForm({
        ...emptyPlanForm,
        termId: selectedTermId,
        classId: selectedClassId,
      })
    }
  }, [initial, selectedTermId, selectedClassId, open])

  const update = (key: keyof StudyPlanFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (
      !form.title.trim() ||
      !form.planType ||
      !form.classId ||
      !form.termId ||
      !form.startDate ||
      !form.endDate
    )
      return
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
          <DialogTitle>{initial ? t('editPlanTitle') : t('createPlanTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>{t('planTitle')}</Label>
            <Input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('planType')}</Label>
            <Select value={form.planType} onValueChange={(v: PlanType) => update('planType', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t('planTypeMonthly')}</SelectItem>
                <SelectItem value="weekly">{t('planTypeWeekly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!initial && (
            <>
              <div className="grid gap-1.5">
                <Label>{t('termLabel')}</Label>
                <Select value={form.termId} onValueChange={(v) => update('termId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectTerm')} />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('classLabel')}</Label>
                <Select value={form.classId} onValueChange={(v) => update('classId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectClass')} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('startDate')}</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('endDate')}</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('description')}</Label>
            <Input
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          {initial && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t('delete')}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.startDate || !form.endDate}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? t('save') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
