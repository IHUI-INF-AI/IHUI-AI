// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 财务部板块(RP-46,2026-11-12 立):AI 一键代账 / AI 一键报税的发起台。
// 本页零新协议:发起 = 往全局 AISidePanel 的对话流写一条结构化指令;
// 执行体是 mcp_server 注册的 ai_bookkeeping / ai_tax_filing 两个 MCP 插件
// (D09 财务专家包与会话预路由都会自动并入白名单,模型分阶段调用);
// 进度回显 = 复用 plan_updated / tool-call-start SSE 帧写进消息级 planSteps 的既有链路。
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Calculator, MessageSquare, Scale, Wallet } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { PlanStepsCard } from '@/components/ai/progress-sections/plan-steps-card'
import { useChat } from '@/hooks/use-chat'
import { useChatStore } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import type { PlanStep } from '@/hooks/use-agent-progress'
import { AutomationCard, type AutomationLaunchOptions } from './automation-card'

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const parseJsonOr = (raw: string): unknown[] | null => {
  const text = raw.trim()
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as unknown
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export default function FinanceAiPage() {
  const t = useTranslations('financeAi')
  const router = useRouter()
  const { sendMessage } = useChat()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [bookTx, setBookTx] = React.useState('')
  const [bookPeriod, setBookPeriod] = React.useState(currentMonth)
  const [taxPeriod, setTaxPeriod] = React.useState(currentMonth)
  const [taxGeneral, setTaxGeneral] = React.useState(true)
  const [taxSales, setTaxSales] = React.useState('')
  const [taxOutput, setTaxOutput] = React.useState('')
  const [taxInput, setTaxInput] = React.useState('')
  const [taxProfit, setTaxProfit] = React.useState('')
  const [taxWages, setTaxWages] = React.useState('')

  // 进度回显:取当前会话最近一条带 planSteps 的 assistant 消息(与气泡内 inline 卡同源数据)
  const planSteps = useChatStore((s) => {
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const m = s.messages[i]
      if (m && m.role === 'assistant' && m.planSteps?.length) return m.planSteps as PlanStep[]
    }
    return []
  })
  const isStreaming = useChatStore((s) => s.isStreaming)
  const conversationId = useChatStore((s) => s.conversationId)

  const launch = async (taskId: string, prompt: string) => {
    useAiPanelStore.getState().openPanel()
    setBusy(taskId)
    try {
      const sent = await sendMessage(prompt)
      if (!sent) toast.error(t('launchFailed'))
    } finally {
      setBusy(null)
    }
  }

  const bookPayload = parseJsonOr(bookTx)
  const canBook = bookPeriod.trim() !== '' && (!bookTx.trim() || bookPayload !== null)
  const bookOk = () => {
    if (!canBook) {
      toast.error(t('txInvalid'))
      return
    }
    const lines = bookPayload
      ? t('promptWithPayload', {
          payload: JSON.stringify(bookPayload),
        })
      : t('promptAskUpload')
    void launch(
      'bookkeeping',
      `${t('promptBookkeeping', { period: bookPeriod })} ${t('phaseBookkeeping')}\n${lines}`,
    )
  }

  const taxPayload = parseJsonOr(taxWages)
  const taxOk = () => {
    if (taxWages.trim() && !taxPayload) {
      toast.error(t('wagesInvalid'))
      return
    }
    const facts = [
      t('fieldPeriod', { period: taxPeriod }),
      taxGeneral ? t('taxpayerGeneral') : t('taxpayerSmall'),
      taxSales && t('fieldSales', { value: taxSales }),
      taxGeneral && taxOutput && t('fieldOutputTax', { value: taxOutput }),
      taxGeneral && taxInput && t('fieldInputTax', { value: taxInput }),
      taxProfit && t('fieldProfit', { value: taxProfit }),
      taxPayload && taxWages.trim()
        ? t('fieldWages', { payload: JSON.stringify(taxPayload) })
        : null,
    ]
      .filter(Boolean)
      .join('；')
    void launch(
      'taxFiling',
      `${t('promptTaxFiling')} ${t('phaseTaxFiling')}\n${facts}\n${t('promptTaxDraftNote')}`,
    )
  }

  const launchAutomation = (opts: AutomationLaunchOptions) => {
    if (opts.targets.length === 0) {
      toast.error(t('automationNoTargets'))
      return
    }
    let portalsText = ''
    if (opts.portalRaw.trim()) {
      let parsed: unknown
      try {
        parsed = JSON.parse(opts.portalRaw)
      } catch {
        toast.error(t('portalInvalid'))
        return
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast.error(t('portalInvalid'))
        return
      }
      portalsText = `, portal=${JSON.stringify(parsed)}`
    }
    if (opts.province.trim()) {
      portalsText += `, province=${opts.province.trim()}`
    }
    const prompt = t('automationPrompt', {
      period: taxPeriod,
      mode: opts.submitMode,
      targets: JSON.stringify(opts.targets),
      portals: portalsText,
    })
    void launch('automation', prompt)
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
            <Wallet className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate">{t('title')}</span>
          </h1>
          <p className="mt-1 text-body leading-relaxed text-muted-foreground">{t('intro')}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              {t('bookkeepingTitle')}
            </CardTitle>
            <CardDescription>{t('bookkeepingDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bk-period">{t('periodLabel')}</Label>
              <Input
                id="bk-period"
                value={bookPeriod}
                onChange={(e) => setBookPeriod(e.target.value)}
                placeholder="2026-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-tx">{t('txLabel')}</Label>
              <textarea
                id="bk-tx"
                value={bookTx}
                onChange={(e) => setBookTx(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder={t('txPh')}
                className="font-[weight:inherit] w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-label leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="font-[weight:inherit] text-label text-muted-foreground">
                {t('txHint')}
              </p>
            </div>
            <Button size="lg" className="w-full gap-1.5" disabled={busy !== null} onClick={bookOk}>
              <MessageSquare className="h-4 w-4" />
              <span>{busy === 'bookkeeping' ? t('starting') : t('bookkeepingCta')}</span>
            </Button>
            <p className="font-[weight:inherit] text-label text-muted-foreground">
              {t('pluginHint')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5 text-primary" />
              {t('taxTitle')}
            </CardTitle>
            <CardDescription>{t('taxDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tx-period">{t('periodLabel')}</Label>
                <Input
                  id="tx-period"
                  value={taxPeriod}
                  onChange={(e) => setTaxPeriod(e.target.value)}
                  placeholder="2026-11 / 2026-11Q4"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-kind">{t('taxpayerLabel')}</Label>
                <select
                  id="tx-kind"
                  value={taxGeneral ? 'general' : 'small'}
                  onChange={(e) => setTaxGeneral(e.target.value === 'general')}
                  className="font-[weight:inherit] h-9 w-full rounded-md border border-input bg-background px-2 text-body focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="general">{t('taxpayerGeneralValue')}</option>
                  <option value="small">{t('taxpayerSmallValue')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-sales">{t('fieldSalesLabel')}</Label>
                <Input
                  id="tx-sales"
                  inputMode="decimal"
                  value={taxSales}
                  onChange={(e) => setTaxSales(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-profit">{t('fieldProfitLabel')}</Label>
                <Input
                  id="tx-profit"
                  inputMode="decimal"
                  value={taxProfit}
                  onChange={(e) => setTaxProfit(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {taxGeneral ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-out">{t('fieldOutputTaxLabel')}</Label>
                    <Input
                      id="tx-out"
                      inputMode="decimal"
                      value={taxOutput}
                      onChange={(e) => setTaxOutput(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-in">{t('fieldInputTaxLabel')}</Label>
                    <Input
                      id="tx-in"
                      inputMode="decimal"
                      value={taxInput}
                      onChange={(e) => setTaxInput(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-wages">{t('wagesLabel')}</Label>
              <textarea
                id="tx-wages"
                value={taxWages}
                onChange={(e) => setTaxWages(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={t('wagesPh')}
                className="font-[weight:inherit] w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-label leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button size="lg" className="w-full gap-1.5" disabled={busy !== null} onClick={taxOk}>
              <MessageSquare className="h-4 w-4" />
              <span>{busy === 'taxFiling' ? t('starting') : t('taxCta')}</span>
            </Button>
            <p className="font-[weight:inherit] text-label text-muted-foreground">
              {t('draftNote')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-1">
        <AutomationCard busy={busy !== null} onLaunch={launchAutomation} />
        <p className="font-[weight:inherit] px-1 text-label text-muted-foreground">
          {t('automationTrust')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('progressTitle')}</CardTitle>
          <CardDescription>{t('progressDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {planSteps.length > 0 ? (
            <PlanStepsCard steps={planSteps} isStreaming={isStreaming} />
          ) : (
            <p className="text-body text-muted-foreground">{t('progressEmpty')}</p>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                useAiPanelStore.getState().openPanel()
                if (conversationId)
                  router.push(`/chat?conversationId=${encodeURIComponent(conversationId)}`)
              }}
              className="gap-1.5"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{t('openChat')}</span>
            </Button>
            <span className="font-[weight:inherit] text-label text-muted-foreground">
              {isStreaming ? t('streaming') : t('idle')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
