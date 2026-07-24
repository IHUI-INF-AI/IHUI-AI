'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

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
import { DatePicker } from '@/components/form/DatePicker'
import type { ExamineForm } from './types'

interface ExamineDialogProps {
  open: boolean
  editing: boolean
  form: ExamineForm
  err: string | null
  isPending: boolean
  onFormChange: (form: ExamineForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function ExamineDialog({
  open,
  editing,
  form,
  err,
  isPending,
  onFormChange,
  onClose,
  onSubmit,
}: ExamineDialogProps) {
  const t = useTranslations('admin.agents.examine')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
              <Label>{t('fieldAgentId')}</Label>
              <Input
                value={form.agentId}
                onChange={(e) => onFormChange({ ...form, agentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldAgentName')}</Label>
              <Input
                value={form.agentName}
                onChange={(e) => onFormChange({ ...form, agentName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldStartTime')}</Label>
              <DatePicker
                value={form.startTime}
                onChange={(v) => onFormChange({ ...form, startTime: v as string })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldStartPhone')}</Label>
              <Input
                value={form.startPhone}
                onChange={(e) => onFormChange({ ...form, startPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldStartName')}</Label>
              <Input
                value={form.startName}
                onChange={(e) => onFormChange({ ...form, startName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldExamineUser')}</Label>
              <Input
                value={form.examineUser}
                onChange={(e) => onFormChange({ ...form, examineUser: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('fieldDesc')}</Label>
            <Input
              value={form.desc}
              onChange={(e) => onFormChange({ ...form, desc: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldFollow')}</Label>
            <Input
              value={form.follow}
              onChange={(e) => onFormChange({ ...form, follow: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldPrologue')}</Label>
            <Input
              value={form.prologue}
              onChange={(e) => onFormChange({ ...form, prologue: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.status}
              onCheckedChange={(v) => onFormChange({ ...form, status: v })}
            />
            <Label>{t('fieldEnable')}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
