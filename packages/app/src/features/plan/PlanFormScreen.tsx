// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { PlanPriority, PlanStepStatus } from '@ihui/shared/plan'
import { PLAN_PRIORITY_OPTIONS, PLAN_STEP_STATUS_OPTIONS } from '@ihui/shared/plan'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { createPlanStyles } from './plan-styles'

/** 步骤草稿(与 web 端 PlanForm StepDraft 同形)。 */
export interface PlanStepDraft {
  title: string
  description: string
  status: PlanStepStatus
  priority: PlanPriority
  estimatedMinutes?: number
}

/** 表单值(与 web 端 PlanFormValues 同形,薄壳直接喂 store.create / store.update)。 */
export interface PlanFormValues {
  title: string
  goal: string
  scope: string
  constraints: string
  tags: string[]
  steps: PlanStepDraft[]
}

export interface PlanFormScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  heading: string
  initial?: Partial<PlanFormValues>
  submitLabel: string
  onSubmit: (values: PlanFormValues) => void
  onCancel?: () => void
}

const EMPTY_DRAFT: PlanStepDraft = {
  title: '',
  description: '',
  status: 'pending',
  priority: 'medium',
}

/** 步骤状态 → i18n 键(显式映射,供详情屏共用;@ihui/shared/plan 只出 labelKey 短名)。 */
export const STEP_STATUS_LABEL_KEYS: Record<PlanStepStatus, string> = {
  pending: 'planPage.stepStatusPending',
  in_progress: 'planPage.stepStatusInProgress',
  completed: 'planPage.stepStatusCompleted',
  blocked: 'planPage.stepStatusBlocked',
  skipped: 'planPage.stepStatusSkipped',
}

/** 优先级 → i18n 键 */
export const PRIORITY_LABEL_KEYS: Record<PlanPriority, string> = {
  low: 'planPage.priorityLow',
  medium: 'planPage.priorityMedium',
  high: 'planPage.priorityHigh',
  critical: 'planPage.priorityCritical',
}

/**
 * 新建/编辑 Plan 共享表单屏 —— 对齐 web apps/web/src/components/plan/PlanForm.tsx:
 * 标题* / 目标* / 修改范围 / 约束边界 / 标签(逗号分隔) / 步骤清单(增删改排序)。
 * web 端 <select> 在 RN 用 chip 行等价(status/priority 单选),校验口径同 web。
 */
export function PlanFormScreen({
  t,
  onBack,
  colorScheme = 'light',
  heading,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: PlanFormScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createPlanStyles(tk), [tk])

  const [title, setTitle] = useState(initial?.title ?? '')
  const [goal, setGoal] = useState(initial?.goal ?? '')
  const [scope, setScope] = useState(initial?.scope ?? '')
  const [constraints, setConstraints] = useState(initial?.constraints ?? '')
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '))
  const [steps, setSteps] = useState<PlanStepDraft[]>(
    initial?.steps && initial.steps.length > 0 ? initial.steps : [{ ...EMPTY_DRAFT }],
  )
  const [error, setError] = useState<string | null>(null)

  const addStep = () => setSteps((s) => [...s, { ...EMPTY_DRAFT }])
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i))
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((s) => {
      const target = i + dir
      if (target < 0 || target >= s.length) return s
      const next = [...s]
      const a = next[i]
      const b = next[target]
      if (a === undefined || b === undefined) return s
      next[i] = b
      next[target] = a
      return next
    })
  }
  const updateStep = (i: number, patch: Partial<PlanStepDraft>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)))

  const handleSubmit = () => {
    setError(null)
    if (!title.trim()) {
      setError(t('planPage.errTitleRequired'))
      return
    }
    if (!goal.trim()) {
      setError(t('planPage.errGoalRequired'))
      return
    }
    const cleanSteps = steps
      .map((s) => ({ ...s, title: s.title.trim(), description: s.description.trim() }))
      .filter((s) => s.title.length > 0)
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    onSubmit({
      title: title.trim(),
      goal: goal.trim(),
      scope: scope.trim(),
      constraints: constraints.trim(),
      tags,
      steps: cleanSteps,
    })
  }

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{heading}</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.formErr}>{error}</Text> : null}

          <Text style={styles.fieldLabel}>{t('planPage.formTitleLabel')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('planPage.formTitlePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={128}
          />

          <Text style={styles.fieldLabel}>{t('planPage.formGoalLabel')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={[styles.input, styles.inputMultiline]}
            value={goal}
            onChangeText={setGoal}
            multiline
            placeholder={t('planPage.formGoalPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />

          <Text style={styles.fieldLabel}>{t('planPage.formScopeLabel')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={[styles.input, styles.inputMultiline]}
            value={scope}
            onChangeText={setScope}
            multiline
            placeholder={t('planPage.formScopePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />

          <Text style={styles.fieldLabel}>{t('planPage.formConstraintsLabel')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={[styles.input, styles.inputMultiline]}
            value={constraints}
            onChangeText={setConstraints}
            multiline
            placeholder={t('planPage.formConstraintsPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />

          <Text style={styles.fieldLabel}>{t('planPage.formTagsLabel')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={tagsInput}
            onChangeText={setTagsInput}
            placeholder={t('planPage.formTagsPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />

          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('planPage.formStepsLabel')}</Text>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('planPage.addStep')}
              onPress={addStep}
            >
              <Text style={styles.secondaryBtnText}>{t('planPage.addStep')}</Text>
            </TouchableOpacity>
          </View>

          {steps.map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={styles.stepHead}>
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{i + 1}</Text>
                </View>
                <TextField
                  colorScheme={colorScheme}
                  style={[styles.input, { flex: 1 }]}
                  value={step.title}
                  onChangeText={(v) => updateStep(i, { title: v })}
                  placeholder={t('planPage.stepTitlePlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                />
                <TouchableOpacity
                  style={[styles.iconBtn, i === 0 && styles.iconBtnDisabled]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('planPage.moveUp')}
                  disabled={i === 0}
                  onPress={() => moveStep(i, -1)}
                >
                  <ChevronUp size={16} color={tk.text.secondary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, i === steps.length - 1 && styles.iconBtnDisabled]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('planPage.moveDown')}
                  disabled={i === steps.length - 1}
                  onPress={() => moveStep(i, 1)}
                >
                  <ChevronDown size={16} color={tk.text.secondary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('planPage.removeStep')}
                  onPress={() => removeStep(i)}
                >
                  <Trash2 size={15} color={tk.error.text} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <TextField
                colorScheme={colorScheme}
                style={[styles.input, styles.inputMultiline, { minHeight: 48, fontSize: 12 }]}
                value={step.description}
                onChangeText={(v) => updateStep(i, { description: v })}
                multiline
                placeholder={t('planPage.stepDescPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
              />
              <View style={styles.chipRow}>
                {PLAN_STEP_STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, step.status === opt.value && styles.chipActive]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    onPress={() => updateStep(i, { status: opt.value })}
                  >
                    <Text
                      style={[styles.chipText, step.status === opt.value && styles.chipTextActive]}
                    >
                      {t(STEP_STATUS_LABEL_KEYS[opt.value])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.chipRow}>
                {PLAN_PRIORITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, step.priority === opt.value && styles.chipActive]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    onPress={() => updateStep(i, { priority: opt.value })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        step.priority === opt.value && styles.chipTextActive,
                      ]}
                    >
                      {t(PRIORITY_LABEL_KEYS[opt.value])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {steps.length === 0 ? (
            <Text style={styles.emptyDesc}>{t('planPage.stepEmpty')}</Text>
          ) : null}

          <View style={styles.formActions}>
            {onCancel ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={onCancel}
              >
                <Text style={styles.secondaryBtnText}>{t('planPage.cancel')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={handleSubmit}
            >
              <Plus size={14} color={tk.brand.ctaForeground} strokeWidth={2.4} />
              <Text style={styles.primaryBtnText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
