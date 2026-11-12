// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 财务部板块 · 国标平台自动化卡(RP-47)。
// 这里只组参数与发起;真正的执行腿 = AI 会话里 ai_*/phase=automation 产计划 +
// browser_*(内置浏览器)/computer_*(原生客户端)逐步执行,提交动作受 submit_mode 闸约束。
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CircuitBoard, MessageSquare } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
} from '@ihui/ui-react'

export const AUTOMATION_TARGETS = [
  'etax_invoice_ledger',
  'etax_vat_declaration',
  'etax_cit_quarterly',
  'etax_iit_declaration',
  'social_insurance',
  'medical_insurance',
  'bank_statement',
] as const

export type AutomationTargetId = (typeof AUTOMATION_TARGETS)[number]

const TARGET_LABEL_KEY: Record<AutomationTargetId, string> = {
  etax_invoice_ledger: 'targetEtaxInvoiceLedger',
  etax_vat_declaration: 'targetEtaxVatDeclaration',
  etax_cit_quarterly: 'targetEtaxCitQuarterly',
  etax_iit_declaration: 'targetEtaxIitDeclaration',
  social_insurance: 'targetSocialInsurance',
  medical_insurance: 'targetMedicalInsurance',
  bank_statement: 'targetBankStatement',
}

/** 报税默认勾选集(与 ai-service _AUTOMATION_DEFAULT_TARGETS.tax 同源语义) */
const DEFAULT_SELECTED: AutomationTargetId[] = [
  'etax_vat_declaration',
  'etax_cit_quarterly',
  'etax_iit_declaration',
  'social_insurance',
  'medical_insurance',
]

export interface AutomationLaunchOptions {
  targets: AutomationTargetId[]
  submitMode: 'manual_gate' | 'user_confirmed'
  portalRaw: string
  province: string
}

interface Props {
  busy: boolean
  onLaunch: (opts: AutomationLaunchOptions) => void
}

export function AutomationCard({ busy, onLaunch }: Props) {
  const t = useTranslations('financeAi')
  const [selected, setSelected] = React.useState<Set<AutomationTargetId>>(
    () => new Set(DEFAULT_SELECTED),
  )
  const [submitMode, setSubmitMode] = React.useState<'manual_gate' | 'user_confirmed'>(
    'manual_gate',
  )
  const [portalRaw, setPortalRaw] = React.useState('')
  const [province, setProvince] = React.useState('')

  const toggle = (id: AutomationTargetId) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = () => {
    onLaunch({
      targets: AUTOMATION_TARGETS.filter((id) => selected.has(id)),
      submitMode,
      portalRaw,
      province,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CircuitBoard className="h-5 w-5 text-primary" />
          {t('automationTitle')}
        </CardTitle>
        <CardDescription>{t('automationDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {AUTOMATION_TARGETS.map((id) => (
            <label key={id} className="flex items-center gap-2 text-body">
              <Checkbox
                checked={selected.has(id)}
                onCheckedChange={() => toggle(id)}
                aria-label={t(TARGET_LABEL_KEY[id])}
              />
              <span className="min-w-0 truncate">{t(TARGET_LABEL_KEY[id])}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="auto-mode">{t('submitModeLabel')}</Label>
            <select
              id="auto-mode"
              value={submitMode}
              onChange={(e) =>
                setSubmitMode(e.target.value === 'user_confirmed' ? 'user_confirmed' : 'manual_gate')
              }
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="manual_gate">{t('submitModeManual')}</option>
              <option value="user_confirmed">{t('submitModeConfirmed')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-province">{t('provinceLabel')}</Label>
            <Input
              id="auto-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="henan / guangdong"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auto-portal">{t('portalLabel')}</Label>
          <textarea
            id="auto-portal"
            value={portalRaw}
            onChange={(e) => setPortalRaw(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder={t('portalPh')}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <Button size="lg" className="w-full gap-1.5" disabled={busy || selected.size === 0} onClick={submit}>
          <MessageSquare className="h-4 w-4" />
          <span>{busy ? t('starting') : t('automationCta')}</span>
        </Button>
        <p className="text-xs text-muted-foreground">{t('browserPrereq')}</p>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
