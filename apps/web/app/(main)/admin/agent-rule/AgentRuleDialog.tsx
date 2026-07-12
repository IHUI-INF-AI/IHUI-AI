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
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { selectClass } from './helpers'
import type { AgentRule, AgentRuleForm } from './types'

interface Props {
  open: boolean
  editing: AgentRule | null
  form: AgentRuleForm
  setForm: React.Dispatch<React.SetStateAction<AgentRuleForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AgentRuleDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.agentRule')
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
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('labelAgentId')}</Label>
            <Input
              value={form.agentId}
              onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              placeholder={t('placeholderAgentId')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('labelRuleName')}</Label>
            <Input
              value={form.ruleName}
              onChange={(e) => setForm({ ...form, ruleName: e.target.value })}
              placeholder={t('placeholderRuleName')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('labelRuleCode')}</Label>
              <Input
                value={form.ruleCode}
                onChange={(e) => setForm({ ...form, ruleCode: e.target.value })}
                placeholder={t('placeholderRuleCode')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('labelRuleType')}</Label>
              <Select
                value={form.ruleType}
                onValueChange={(v) => setForm({ ...form, ruleType: v })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filter">{t('ruleTypeFilter')}</SelectItem>
                  <SelectItem value="replace">{t('ruleTypeReplace')}</SelectItem>
                  <SelectItem value="limit">{t('ruleTypeLimit')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>{t('labelPriority')}</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>{t('labelEnabled')}</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('labelDescription')}</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('placeholderDescription')}
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
