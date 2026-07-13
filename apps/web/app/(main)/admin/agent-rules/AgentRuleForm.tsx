'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import type { RuleForm } from './types'

interface Props {
  form: RuleForm
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function AgentRuleForm({ form, setForm, err, savePending, onSubmit, onCancel }: Props) {
  const t = useTranslations('admin.agentRules')
  const RULE_TYPES = [
    { value: 'text', label: t('ruleTypes.text') },
    { value: 'regex', label: t('ruleTypes.regex') },
    { value: 'llm', label: t('ruleTypes.llm') },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('formTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="r-agent">{t('agentId')}</Label>
              <Input
                id="r-agent"
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                placeholder={t('agentIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-name">{t('ruleName')}</Label>
              <Input
                id="r-name"
                value={form.ruleName}
                onChange={(e) => setForm({ ...form, ruleName: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-code">{t('ruleCode')}</Label>
              <Input
                id="r-code"
                value={form.ruleCode}
                onChange={(e) => setForm({ ...form, ruleCode: e.target.value })}
                placeholder={t('codePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-type">{t('ruleType')}</Label>
              <Select
                value={form.ruleType}
                onValueChange={(v) => setForm({ ...form, ruleType: v })}
              >
                <SelectTrigger id="r-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-priority">{t('priority')}</Label>
              <Input
                id="r-priority"
                type="number"
                min="0"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-status">{t('status')}</Label>
              <Select
                value={form.status ? '1' : '0'}
                onValueChange={(v) => setForm({ ...form, status: v === '1' })}
              >
                <SelectTrigger id="r-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('enable')}</SelectItem>
                  <SelectItem value="0">{t('disable')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-desc">{t('description')}</Label>
            <Input
              id="r-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
