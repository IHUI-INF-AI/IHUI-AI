'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'
import type { AgentTask, AgentTaskForm } from './types'

interface Props {
  open: boolean
  editing: AgentTask | null
  form: AgentTaskForm
  setForm: React.Dispatch<React.SetStateAction<AgentTaskForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AgentTaskDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.agentTask')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
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
            <Label>{t('fieldTitle')}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fieldContext')}</Label>
            <Input
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('fieldLowestPrice')}</Label>
              <Input
                value={form.lowestPrice}
                onChange={(e) => setForm({ ...form, lowestPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldPeakPrice')}</Label>
              <Input
                value={form.peakPrice}
                onChange={(e) => setForm({ ...form, peakPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldCycle')}</Label>
              <Input
                value={form.cycle}
                onChange={(e) => setForm({ ...form, cycle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldCycleUnit')}</Label>
              <Input
                value={form.cycleUnit}
                onChange={(e) => setForm({ ...form, cycleUnit: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('fieldClosingTime')}</Label>
            <DatePicker
              value={form.closingTime}
              onChange={(v) => setForm({ ...form, closingTime: v as string })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
