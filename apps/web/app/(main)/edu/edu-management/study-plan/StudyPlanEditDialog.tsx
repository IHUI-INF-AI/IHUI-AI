'use client'

import * as React from 'react'
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
          <DialogTitle>{initial ? '编辑学习计划' : '创建学习计划'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>计划标题</Label>
            <Input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="例如：2025年3月学习计划"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>计划类型</Label>
            <Select value={form.planType} onValueChange={(v: PlanType) => update('planType', v)}>
              <SelectTrigger>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">月计划</SelectItem>
                <SelectItem value="weekly">周计划</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!initial && (
            <>
              <div className="grid gap-1.5">
                <Label>所属学期</Label>
                <Select value={form.termId} onValueChange={(v) => update('termId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择学期" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>所属班级</Label>
                <Select value={form.classId} onValueChange={(v) => update('classId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择班级" />
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
              <Label>开始日期</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>描述</Label>
            <Input
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="计划描述（可选）"
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
              删除
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.startDate || !form.endDate}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
