'use client'

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@ihui/ui-react'
import { inputCls, DATA_TYPES } from './helpers'
import type { VariableForm } from './types'

interface Props {
  open: boolean
  editing: boolean
  form: VariableForm
  submitting: boolean
  onClose: () => void
  onChange: (form: VariableForm) => void
  onSubmit: (e: React.FormEvent) => void
}

export function VariableDialog({ open, editing, form, submitting, onClose, onChange, onSubmit }: Props) {
  const t = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? '编辑变量' : '创建变量'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="var-bot-id" className="block text-sm font-medium">
              Bot ID *
            </label>
            <input
              id="var-bot-id"
              className={inputCls}
              placeholder="Bot ID"
              value={form.botId}
              onChange={(e) => onChange({ ...form, botId: e.target.value })}
              disabled={editing}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="var-name" className="block text-sm font-medium">
              变量名 *
            </label>
            <input
              id="var-name"
              className={inputCls}
              placeholder="variableName"
              value={form.variableName}
              onChange={(e) => onChange({ ...form, variableName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="var-value" className="block text-sm font-medium">
              变量值
            </label>
            <input
              id="var-value"
              className={inputCls}
              placeholder="variableValue"
              value={form.variableValue}
              onChange={(e) => onChange({ ...form, variableValue: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="var-type" className="block text-sm font-medium">
              数据类型
            </label>
            <select
              id="var-type"
              className={inputCls}
              value={form.dataType}
              onChange={(e) => onChange({ ...form, dataType: e.target.value })}
            >
              {DATA_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="var-desc" className="block text-sm font-medium">
              描述
            </label>
            <input
              id="var-desc"
              className={inputCls}
              placeholder="description"
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
