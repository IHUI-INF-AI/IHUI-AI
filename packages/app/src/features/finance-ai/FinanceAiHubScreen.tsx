// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  Calculator,
  Check,
  CircuitBoard,
  Landmark,
  MessageSquare,
  Scale,
  Wallet,
} from 'lucide-react-native'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createFinanceAiStyles, FINANCE_AI_PALETTE } from './finance-ai-styles'

/**
 * 财务部板块共享屏(RP-46 miniapp-taro/RN 镜像,2026-11-12 立)。
 *
 * 结构对齐 web apps/web/app/(main)/admin/finance-ai/page.tsx:
 * AI 一键代账卡 + AI 一键报税卡 + 国标平台自动化卡 + 任务进度回显。
 * 本屏纯展示(props 注入),取数/校验/组 prompt/唤起对话全部由薄壳驱动
 * (apps/mobile-rn/src/screens/FinanceAiHubScreen.tsx),与 edu-ai 域同一形制。
 *
 * 移动端唤起对话 = 薄壳 navigation.navigate('Chat', { autoSendPrompt }) 走既有
 * send(overrideText) 出口(登录/VIP/流式校验齐全),不新造 LLM 调用链。
 */

/** 平台自动化目标 id 与 web automation-card.tsx AUTOMATION_TARGETS 同源同序。 */
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
  etax_invoice_ledger: 'financeAi.targetEtaxInvoiceLedger',
  etax_vat_declaration: 'financeAi.targetEtaxVatDeclaration',
  etax_cit_quarterly: 'financeAi.targetEtaxCitQuarterly',
  etax_iit_declaration: 'financeAi.targetEtaxIitDeclaration',
  social_insurance: 'financeAi.targetSocialInsurance',
  medical_insurance: 'financeAi.targetMedicalInsurance',
  bank_statement: 'financeAi.targetBankStatement',
}

/** 报税默认勾选集(与 ai-service _AUTOMATION_DEFAULT_TARGETS.tax 同源语义)。 */
export const AUTOMATION_DEFAULT_SELECTED: readonly AutomationTargetId[] = [
  'etax_vat_declaration',
  'etax_cit_quarterly',
  'etax_iit_declaration',
  'social_insurance',
  'medical_insurance',
]

export interface FinanceAiBookkeepingDraft {
  period: string
  tx: string
}
export interface FinanceAiTaxDraft {
  period: string
  general: boolean
  sales: string
  outputTax: string
  inputTax: string
  profit: string
  wages: string
}
export interface FinanceAiAutomationDraft {
  selected: readonly AutomationTargetId[]
  submitMode: 'manual_gate' | 'user_confirmed'
  portalRaw: string
  province: string
}

/** 进度回显的一步(与 web PlanStep 渲染同构的最小投影)。 */
export interface FinanceAiProgressStep {
  text: string
  active?: boolean
}

export interface FinanceAiHubScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  busy: string | null
  bookkeeping: FinanceAiBookkeepingDraft
  tax: FinanceAiTaxDraft
  automation: FinanceAiAutomationDraft
  progressSteps: readonly FinanceAiProgressStep[]
  isStreaming: boolean
  onBookkeepingChange: (patch: Partial<FinanceAiBookkeepingDraft>) => void
  onBookkeepingLaunch: () => void
  onTaxChange: (patch: Partial<FinanceAiTaxDraft>) => void
  onTaxLaunch: () => void
  onAutomationChange: (patch: Partial<FinanceAiAutomationDraft>) => void
  onAutomationLaunch: () => void
}

export function FinanceAiHubScreen({
  t,
  colorScheme = 'light',
  onBack,
  busy,
  bookkeeping,
  tax,
  automation,
  progressSteps,
  isStreaming,
  onBookkeepingChange,
  onBookkeepingLaunch,
  onTaxChange,
  onTaxLaunch,
  onAutomationChange,
  onAutomationLaunch,
}: FinanceAiHubScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createFinanceAiStyles(tk), [tk])
  const k = (name: string) => `financeAi.${name}`

  const ctaLabel = (taskId: string, ready: string) =>
    busy ? (busy === taskId ? t(k('starting')) : t(k('idle'))) : ready

  const toggleTarget = (id: AutomationTargetId) => {
    const has = automation.selected.includes(id)
    const next = has ? automation.selected.filter((x) => x !== id) : [...automation.selected, id]
    onAutomationChange({ selected: next })
  }

  const cardIcon = (Icon: typeof Wallet) => (
    <Icon size={18} color={tk.brandAccent.DEFAULT} strokeWidth={2} />
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        {cardIcon(Wallet)}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t(k('title'))}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t(k('intro'))}</Text>

        {/* ── AI 一键代账 ── */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            {cardIcon(Calculator)}
            <Text style={styles.cardTitle}>{t(k('bookkeepingTitle'))}</Text>
          </View>
          <Text style={styles.cardDesc}>{t(k('bookkeepingDesc'))}</Text>
          <Text style={styles.fieldLabel}>{t(k('periodLabel'))}</Text>
          <TextInput
            style={styles.input}
            value={bookkeeping.period}
            onChangeText={(v) => onBookkeepingChange({ period: v })}
            placeholder="2026-11"
            placeholderTextColor={tk.text.tertiary}
            accessibilityLabel={t(k('periodLabel'))}
          />
          <Text style={styles.fieldLabel}>{t(k('txLabel'))}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={bookkeeping.tx}
            onChangeText={(v) => onBookkeepingChange({ tx: v })}
            placeholder={t(k('txPh'))}
            placeholderTextColor={tk.text.tertiary}
            multiline
            accessibilityLabel={t(k('txLabel'))}
          />
          <TouchableOpacity
            style={[styles.cta, busy ? styles.ctaDisabled : null]}
            disabled={busy !== null}
            accessibilityRole="button"
            onPress={onBookkeepingLaunch}
          >
            <MessageSquare size={15} color={tk.brand.ctaForeground} strokeWidth={2} />
            <Text style={styles.ctaText}>{ctaLabel('bookkeeping', t(k('bookkeepingCta')))}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>{t(k('pluginHint'))}</Text>
        </View>

        {/* ── AI 一键报税 ── */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            {cardIcon(Scale)}
            <Text style={styles.cardTitle}>{t(k('taxTitle'))}</Text>
          </View>
          <Text style={styles.cardDesc}>{t(k('taxDesc'))}</Text>
          <Text style={styles.fieldLabel}>{t(k('periodLabel'))}</Text>
          <TextInput
            style={styles.input}
            value={tax.period}
            onChangeText={(v) => onTaxChange({ period: v })}
            placeholder="2026-11"
            placeholderTextColor={tk.text.tertiary}
            accessibilityLabel={t(k('periodLabel'))}
          />
          <Text style={styles.fieldLabel}>{t(k('taxpayerLabel'))}</Text>
          <View style={styles.targetGrid}>
            {(
              [
                { general: true, label: t(k('taxpayerGeneralValue')) },
                { general: false, label: t(k('taxpayerSmallValue')) },
              ] as const
            ).map((opt) => {
              const active = tax.general === opt.general
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.targetChip, active ? styles.targetChipActive : null]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => onTaxChange({ general: opt.general })}
                >
                  {active ? (
                    <Check size={13} color={FINANCE_AI_PALETTE.emerald.fg} strokeWidth={2.5} />
                  ) : null}
                  <Text
                    style={[styles.targetChipText, active ? styles.targetChipTextActive : null]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text style={styles.fieldLabel}>{t(k('fieldSalesLabel'))}</Text>
          <TextInput
            style={styles.input}
            value={tax.sales}
            onChangeText={(v) => onTaxChange({ sales: v })}
            placeholder={t(k('txPh'))}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="decimal-pad"
            accessibilityLabel={t(k('fieldSalesLabel'))}
          />
          {tax.general ? (
            <>
              <Text style={styles.fieldLabel}>{t(k('fieldOutputTaxLabel'))}</Text>
              <TextInput
                style={styles.input}
                value={tax.outputTax}
                onChangeText={(v) => onTaxChange({ outputTax: v })}
                placeholderTextColor={tk.text.tertiary}
                keyboardType="decimal-pad"
                accessibilityLabel={t(k('fieldOutputTaxLabel'))}
              />
              <Text style={styles.fieldLabel}>{t(k('fieldInputTaxLabel'))}</Text>
              <TextInput
                style={styles.input}
                value={tax.inputTax}
                onChangeText={(v) => onTaxChange({ inputTax: v })}
                placeholderTextColor={tk.text.tertiary}
                keyboardType="decimal-pad"
                accessibilityLabel={t(k('fieldInputTaxLabel'))}
              />
            </>
          ) : null}
          <Text style={styles.fieldLabel}>{t(k('fieldProfitLabel'))}</Text>
          <TextInput
            style={styles.input}
            value={tax.profit}
            onChangeText={(v) => onTaxChange({ profit: v })}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="decimal-pad"
            accessibilityLabel={t(k('fieldProfitLabel'))}
          />
          <Text style={styles.fieldLabel}>{t(k('wagesLabel'))}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={tax.wages}
            onChangeText={(v) => onTaxChange({ wages: v })}
            placeholder={t(k('wagesPh'))}
            placeholderTextColor={tk.text.tertiary}
            multiline
            accessibilityLabel={t(k('wagesLabel'))}
          />
          <TouchableOpacity
            style={[styles.cta, busy ? styles.ctaDisabled : null]}
            disabled={busy !== null}
            accessibilityRole="button"
            onPress={onTaxLaunch}
          >
            <MessageSquare size={15} color={tk.brand.ctaForeground} strokeWidth={2} />
            <Text style={styles.ctaText}>{ctaLabel('taxFiling', t(k('taxCta')))}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>{t(k('draftNote'))}</Text>
        </View>

        {/* ── 国标平台自动化 ── */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            {cardIcon(CircuitBoard)}
            <Text style={styles.cardTitle}>{t(k('automationTitle'))}</Text>
          </View>
          <Text style={styles.cardDesc}>{t(k('automationDesc'))}</Text>
          <View style={styles.targetGrid}>
            {AUTOMATION_TARGETS.map((id) => {
              const active = automation.selected.includes(id)
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.targetChip, active ? styles.targetChipActive : null]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  onPress={() => toggleTarget(id)}
                >
                  {active ? (
                    <Check size={13} color={FINANCE_AI_PALETTE.emerald.fg} strokeWidth={2.5} />
                  ) : null}
                  <Text
                    style={[styles.targetChipText, active ? styles.targetChipTextActive : null]}
                  >
                    {t(TARGET_LABEL_KEY[id])}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text style={styles.fieldLabel}>{t(k('submitModeLabel'))}</Text>
          <View style={styles.targetGrid}>
            {[
              { mode: 'manual_gate' as const, label: t(k('submitModeManual')) },
              { mode: 'user_confirmed' as const, label: t(k('submitModeConfirmed')) },
            ].map((opt) => {
              const active = automation.submitMode === opt.mode
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[styles.targetChip, active ? styles.targetChipActive : null]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => onAutomationChange({ submitMode: opt.mode })}
                >
                  {active ? (
                    <Check size={13} color={FINANCE_AI_PALETTE.emerald.fg} strokeWidth={2.5} />
                  ) : null}
                  <Text
                    style={[styles.targetChipText, active ? styles.targetChipTextActive : null]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text style={styles.fieldLabel}>{t(k('provinceLabel'))}</Text>
          <TextInput
            style={styles.input}
            value={automation.province}
            onChangeText={(v) => onAutomationChange({ province: v })}
            placeholder="henan / guangdong"
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
            accessibilityLabel={t(k('provinceLabel'))}
          />
          <Text style={styles.fieldLabel}>{t(k('portalLabel'))}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={automation.portalRaw}
            onChangeText={(v) => onAutomationChange({ portalRaw: v })}
            placeholder={t(k('portalPh'))}
            placeholderTextColor={tk.text.tertiary}
            multiline
            autoCapitalize="none"
            accessibilityLabel={t(k('portalLabel'))}
          />
          <TouchableOpacity
            style={[
              styles.cta,
              busy || automation.selected.length === 0 ? styles.ctaDisabled : null,
            ]}
            disabled={busy !== null || automation.selected.length === 0}
            accessibilityRole="button"
            onPress={onAutomationLaunch}
          >
            <MessageSquare size={15} color={tk.brand.ctaForeground} strokeWidth={2} />
            <Text style={styles.ctaText}>{ctaLabel('automation', t(k('automationCta')))}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>{t(k('browserPrereq'))}</Text>
          <Text style={styles.note}>{t(k('automationTrust'))}</Text>
        </View>

        {/* ── 任务进度回显 ── */}
        <View style={styles.card}>
          <View style={styles.progressHead}>
            {cardIcon(Landmark)}
            <Text style={styles.progressTitle}>{t(k('progressTitle'))}</Text>
          </View>
          <Text style={styles.note}>{t(k('progressDesc'))}</Text>
          {progressSteps.length === 0 ? (
            <Text style={styles.emptyText}>
              {isStreaming ? t(k('streaming')) : t(k('progressEmpty'))}
            </Text>
          ) : (
            progressSteps.map((step, i) => (
              <View key={`${i}-${step.text}`} style={styles.stepRow}>
                <View style={[styles.stepDot, step.active ? styles.stepDotActive : null]} />
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
