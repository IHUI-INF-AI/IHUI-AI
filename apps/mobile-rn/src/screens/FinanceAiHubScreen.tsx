// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  FinanceAiHubScreen as SharedFinanceAiHubScreen,
  AUTOMATION_DEFAULT_SELECTED,
  type FinanceAiBookkeepingDraft,
  type FinanceAiProgressStep,
  type FinanceAiTaxDraft,
  type FinanceAiAutomationDraft,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web finance-ai/page.tsx currentMonth 同口径:发起台的默认会计/申报期间。 */
function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** web parseJsonOr 同口径:仅接受 JSON 数组(业务流水/工资表载荷)。 */
function parseArrayOr(raw: string): unknown[] | null {
  const text = raw.trim()
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * RN 端「财务部」板块薄壳 —— 承载 web /admin/finance-ai(RP-46,2026-11-12)。
 * 渲染全部委托共享屏 `packages/app/src/features/finance-ai/FinanceAiHubScreen.tsx`,
 * 本文件只管平台侧:本地草稿态 + 组结构化指令 + 唤起对话。
 *
 * 唤起对话 = navigation.navigate('Chat', { autoSendPrompt }) —— 走既有 send(overrideText)
 * 出口(登录/VIP/流式校验齐全),不新造 LLM 调用链;进度在 Chat 屏内按消息级 planSteps 实时回显。
 * 执行体 = mcp_server 的 ai_bookkeeping / ai_tax_filing 两 MCP 插件(D09 专家包自动并入白名单)。
 */
export function FinanceAiHubScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [busy, setBusy] = useState<string | null>(null)
  const [bookkeeping, setBookkeeping] = useState<FinanceAiBookkeepingDraft>({
    period: currentMonth(),
    tx: '',
  })
  const [tax, setTax] = useState<FinanceAiTaxDraft>({
    period: currentMonth(),
    general: true,
    sales: '',
    outputTax: '',
    inputTax: '',
    profit: '',
    wages: '',
  })
  const [automation, setAutomation] = useState<FinanceAiAutomationDraft>({
    selected: AUTOMATION_DEFAULT_SELECTED,
    submitMode: 'manual_gate',
    portalRaw: '',
    province: '',
  })

  const launch = useCallback(
    (taskId: string, prompt: string) => {
      setBusy(taskId)
      try {
        navigation.navigate('Chat', { autoSendPrompt: prompt })
      } finally {
        setBusy(null)
      }
    },
    [navigation],
  )

  const onBookkeepingLaunch = useCallback(() => {
    const period = bookkeeping.period.trim()
    if (period === '') return
    const payload = parseArrayOr(bookkeeping.tx)
    const lines = payload
      ? t('financeAi.promptWithPayload', { payload: JSON.stringify(payload) })
      : t('financeAi.promptAskUpload')
    launch(
      'bookkeeping',
      `${t('financeAi.promptBookkeeping', { period })} ${t('financeAi.phaseBookkeeping')}\n${lines}`,
    )
  }, [bookkeeping.period, bookkeeping.tx, launch, t])

  const onTaxLaunch = useCallback(() => {
    const wagesPayload = tax.wages.trim() ? parseArrayOr(tax.wages) : null
    if (tax.wages.trim() && !wagesPayload) return
    const facts = [
      t('financeAi.fieldPeriod', { period: tax.period }),
      tax.general ? t('financeAi.taxpayerGeneral') : t('financeAi.taxpayerSmall'),
      tax.sales && t('financeAi.fieldSales', { value: tax.sales }),
      tax.general && tax.outputTax && t('financeAi.fieldOutputTax', { value: tax.outputTax }),
      tax.general && tax.inputTax && t('financeAi.fieldInputTax', { value: tax.inputTax }),
      tax.profit && t('financeAi.fieldProfit', { value: tax.profit }),
      wagesPayload && t('financeAi.fieldWages', { payload: JSON.stringify(wagesPayload) }),
    ]
      .filter(Boolean)
      .join('；')
    launch(
      'taxFiling',
      `${t('financeAi.promptTaxFiling')} ${t('financeAi.phaseTaxFiling')}\n${facts}\n${t('financeAi.promptTaxDraftNote')}`,
    )
  }, [launch, t, tax])

  const onAutomationLaunch = useCallback(() => {
    if (automation.selected.length === 0) return
    let portalsText = ''
    const portalRaw = automation.portalRaw.trim()
    if (portalRaw) {
      let parsed: unknown
      try {
        parsed = JSON.parse(portalRaw)
      } catch {
        return
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      portalsText = `, portal=${JSON.stringify(parsed)}`
    }
    if (automation.province.trim()) portalsText += `, province=${automation.province.trim()}`
    launch(
      'automation',
      t('financeAi.automationPrompt', {
        period: tax.period,
        mode: automation.submitMode,
        targets: JSON.stringify(automation.selected),
        portals: portalsText,
      }),
    )
  }, [automation, launch, t, tax.period])

  /** 进度卡:唤起后进度在 Chat 屏内按消息级 planSteps 实时回显,本卡给入口(薄壳不跨屏轮询 chat 态)。 */
  const progressSteps = useMemo<readonly FinanceAiProgressStep[]>(() => [], [])

  return (
    <SharedFinanceAiHubScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      busy={busy}
      bookkeeping={bookkeeping}
      tax={tax}
      automation={automation}
      progressSteps={progressSteps}
      isStreaming={false}
      onBookkeepingChange={(patch) => setBookkeeping((p) => ({ ...p, ...patch }))}
      onBookkeepingLaunch={onBookkeepingLaunch}
      onTaxChange={(patch) => setTax((p) => ({ ...p, ...patch }))}
      onTaxLaunch={onTaxLaunch}
      onAutomationChange={(patch) => setAutomation((p) => ({ ...p, ...patch }))}
      onAutomationLaunch={onAutomationLaunch}
    />
  )
}

export default FinanceAiHubScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
