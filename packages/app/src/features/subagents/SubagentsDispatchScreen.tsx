// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { CircleX, Send } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'subagentsDispatchPage'

/** 与 web ROLE_OPTIONS 同值集(apps/web/src/components/subagents/DispatchForm.tsx:20-26) */
const ROLE_VALUES = ['researcher', 'coder', 'reviewer', 'architect', 'debugger'] as const
/** 与 web ORCH_OPTIONS 同值集(DispatchForm.tsx:28-36) */
const ORCH_VALUES = [
  'pipeline',
  'parallel',
  'debate',
  'vote',
  'critique',
  'decomposed',
  'with_communication',
] as const
/** 与 web PRIORITY_OPTIONS 同值集(DispatchForm.tsx:38-43) */
const PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent'] as const

const ROLE_KEYS: Record<string, string> = {
  researcher: 'roleResearcher',
  coder: 'roleCoder',
  reviewer: 'roleReviewer',
  architect: 'roleArchitect',
  debugger: 'roleDebugger',
}

const ORCH_KEYS: Record<string, string> = {
  pipeline: 'orchPipeline',
  parallel: 'orchParallel',
  debate: 'orchDebate',
  vote: 'orchVote',
  critique: 'orchCritique',
  decomposed: 'orchDecomposed',
  with_communication: 'orchWithCommunication',
}

const PRIORITY_KEYS: Record<string, string> = {
  low: 'priorityLow',
  normal: 'priorityNormal',
  high: 'priorityHigh',
  urgent: 'priorityUrgent',
}

export interface SubagentsDispatchResultView {
  id: string
  statusText: string
}

export interface SubagentsDispatchScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web 页同口径) */
  loginRequiredText: string
  goal: string
  affectedFiles: string
  forbidden: string
  verifyCommands: string
  constraints: string
  deliverables: string
  onGoalChange: (value: string) => void
  onAffectedFilesChange: (value: string) => void
  onForbiddenChange: (value: string) => void
  onVerifyCommandsChange: (value: string) => void
  onConstraintsChange: (value: string) => void
  onDeliverablesChange: (value: string) => void
  agentRole: string
  orchestration: string
  priority: string
  onAgentRoleChange: (value: string) => void
  onOrchestrationChange: (value: string) => void
  onPriorityChange: (value: string) => void
  retryCount: string
  retryDelayMs: string
  timeoutMs: string
  tokenQuota: string
  maxRetries: string
  onRetryCountChange: (value: string) => void
  onRetryDelayChange: (value: string) => void
  onTimeoutChange: (value: string) => void
  onTokenQuotaChange: (value: string) => void
  onMaxRetriesChange: (value: string) => void
  /** 提交中(web isSubmitting 同义) */
  submitting: boolean
  error: string | null
  result: SubagentsDispatchResultView | null
  onSubmit: () => void
  /** 派单成功后「再派一个」:复位表单(web dispatchAnother 同义) */
  onDispatchAnother: () => void
}

/**
 * Subagent 派单共享屏 —— 承载 web /subagents/dispatch。
 *
 * 端点与 web 同一封装:packages/api-client/src/endpoints/subagents.ts 的 dispatchSubagent
 * (POST /api/subagents/dispatch);后端 apps/api/src/routes/subagent-dispatch.ts:400-428,
 * 入参 zod 校验(:93-118),成功 success({dispatch}),并发超限 429 / DAG 循环依赖 400 走 error 信封。
 *
 * 与 web 的口径差(如实登记):web 表单(DispatchForm.tsx:112-477)里的「DAG 节点 / 边编辑器」
 * 子面板未在 RN 承载(需多行动态行编辑,本轮按主路径优先省略,未造假入口);其余字段与取值集逐一同源。
 * 平台无关:提交、错误归一、登录门由薄壳注入。
 */
export function SubagentsDispatchScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  goal,
  affectedFiles,
  forbidden,
  verifyCommands,
  constraints,
  deliverables,
  onGoalChange,
  onAffectedFilesChange,
  onForbiddenChange,
  onVerifyCommandsChange,
  onConstraintsChange,
  onDeliverablesChange,
  agentRole,
  orchestration,
  priority,
  onAgentRoleChange,
  onOrchestrationChange,
  onPriorityChange,
  retryCount,
  retryDelayMs,
  timeoutMs,
  tokenQuota,
  maxRetries,
  onRetryCountChange,
  onRetryDelayChange,
  onTimeoutChange,
  onTokenQuotaChange,
  onMaxRetriesChange,
  submitting,
  error,
  result,
  onSubmit,
  onDispatchAnother,
}: SubagentsDispatchScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = createStyles(tk)
  const canSubmit =
    goal.trim().length > 0 &&
    affectedFiles.trim().length > 0 &&
    constraints.trim().length > 0 &&
    deliverables.trim().length > 0 &&
    !submitting

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t(`${NS}.title`)}</Text>
      </View>

      {loginRequiredText ? (
        <Text style={styles.muted}>{loginRequiredText}</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {error ? (
            <View style={styles.errorBox}>
              <CircleX size={16} color={tk.danger.DEFAULT} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>{t(`${NS}.goalLabel`)} *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={goal}
              onChangeText={onGoalChange}
              placeholder={t(`${NS}.goalPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>{t(`${NS}.affectedFilesLabel`)} *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={affectedFiles}
              onChangeText={onAffectedFilesChange}
              placeholder={t(`${NS}.affectedFilesLabel`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>{t(`${NS}.forbiddenLabel`)}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={forbidden}
              onChangeText={onForbiddenChange}
              placeholder={t(`${NS}.forbiddenPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>{t(`${NS}.verifyLabel`)}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={verifyCommands}
              onChangeText={onVerifyCommandsChange}
              placeholder={t(`${NS}.verifyLabel`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>{t(`${NS}.constraintsLabel`)} *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={constraints}
              onChangeText={onConstraintsChange}
              placeholder={t(`${NS}.constraintsPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>{t(`${NS}.deliverablesLabel`)} *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={deliverables}
              onChangeText={onDeliverablesChange}
              placeholder={t(`${NS}.deliverablesPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              editable={!submitting}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t(`${NS}.agentRoleLabel`)}</Text>
            <View style={styles.chipRow}>
              <Chip
                label={t(`${NS}.defaultOption`)}
                active={!agentRole}
                onPress={() => onAgentRoleChange('')}
                tk={tk}
              />
              {ROLE_VALUES.map((value) => (
                <Chip
                  key={value}
                  label={t(`${NS}.${ROLE_KEYS[value]}`)}
                  active={agentRole === value}
                  onPress={() => onAgentRoleChange(value)}
                  tk={tk}
                />
              ))}
            </View>

            <Text style={styles.label}>{t(`${NS}.orchestrationLabel`)}</Text>
            <View style={styles.chipRow}>
              <Chip
                label={t(`${NS}.defaultOption`)}
                active={!orchestration}
                onPress={() => onOrchestrationChange('')}
                tk={tk}
              />
              {ORCH_VALUES.map((value) => (
                <Chip
                  key={value}
                  label={t(`${NS}.${ORCH_KEYS[value]}`)}
                  active={orchestration === value}
                  onPress={() => onOrchestrationChange(value)}
                  tk={tk}
                />
              ))}
            </View>

            <Text style={styles.label}>{t(`${NS}.priorityLabel`)}</Text>
            <View style={styles.chipRow}>
              <Chip
                label={t(`${NS}.defaultOption`)}
                active={!priority}
                onPress={() => onPriorityChange('')}
                tk={tk}
              />
              {PRIORITY_VALUES.map((value) => (
                <Chip
                  key={value}
                  label={t(`${NS}.${PRIORITY_KEYS[value]}`)}
                  active={priority === value}
                  onPress={() => onPriorityChange(value)}
                  tk={tk}
                />
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t(`${NS}.retryQuotaTitle`)}</Text>
            <NumberField
              label={t(`${NS}.retryCount`)}
              value={retryCount}
              onChange={onRetryCountChange}
              tk={tk}
              editable={!submitting}
            />
            <NumberField
              label={t(`${NS}.retryDelayMs`)}
              value={retryDelayMs}
              onChange={onRetryDelayChange}
              tk={tk}
              editable={!submitting}
            />
            <NumberField
              label={t(`${NS}.timeoutMs`)}
              value={timeoutMs}
              onChange={onTimeoutChange}
              tk={tk}
              editable={!submitting}
            />
            <NumberField
              label={t(`${NS}.tokenQuota`)}
              value={tokenQuota}
              onChange={onTokenQuotaChange}
              tk={tk}
              editable={!submitting}
            />
            <NumberField
              label={t(`${NS}.maxRetries`)}
              value={maxRetries}
              onChange={onMaxRetriesChange}
              tk={tk}
              editable={!submitting}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t(`${NS}.resultTitle`)}</Text>
            {submitting ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.submitting`)}</Text>
              </View>
            ) : result ? (
              <>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>ID</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {result.id}
                  </Text>
                </View>
                <Text style={styles.badge}>{result.statusText}</Text>
                <TouchableOpacity style={styles.outlineBtn} onPress={onDispatchAnother}>
                  <Text style={styles.outlineBtnText}>{t(`${NS}.dispatchAnother`)}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
            ) : (
              <Send size={16} color={tk.brand.ctaForeground} />
            )}
            <Text style={styles.primaryBtnText}>
              {submitting ? t(`${NS}.submitting`) : t(`${NS}.submit`)}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  )
}

function Chip({
  label,
  active,
  onPress,
  tk,
}: {
  label: string
  active: boolean
  onPress: () => void
  tk: AppThemeTokens
}) {
  return (
    <TouchableOpacity
      style={{
        paddingHorizontal: rnSpacing.md,
        paddingVertical: rnSpacing.xs,
        borderRadius: rnRadius.md,
        borderWidth: 1,
        borderColor: active ? tk.brand.DEFAULT : tk.border.light,
        backgroundColor: active ? tk.surface.muted : tk.surface.card,
      }}
      onPress={onPress}
    >
      <Text
        style={{
          fontSize: rnType.caption.size,
          color: active ? tk.text.primary : tk.text.secondary,
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function NumberField({
  label,
  value,
  onChange,
  tk,
  editable,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  tk: AppThemeTokens
  editable: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm }}>
      <Text style={{ flex: 1, fontSize: rnType.caption.size, color: tk.text.secondary }}>
        {label}
      </Text>
      <TextInput
        style={{
          width: 120,
          height: 36,
          paddingHorizontal: rnSpacing.sm,
          borderRadius: rnRadius.md,
          borderWidth: 1,
          borderColor: tk.border.light,
          backgroundColor: tk.surface.inputBg,
          fontSize: rnType.caption.size,
          color: tk.text.primary,
          textAlign: 'right',
        }}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        editable={editable}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    title: { flex: 1, fontSize: 20, fontWeight: '600', color: tk.text.primary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    label: { fontSize: rnType.caption.size, fontWeight: '500', color: tk.text.secondary },
    sectionTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    input: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    textArea: { minHeight: 68, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    fieldValue: { flex: 1, textAlign: 'right', fontSize: rnType.caption.size, color: tk.text.primary },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      overflow: 'hidden',
    },
    centerBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.lg,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.ctaForeground },
    outlineBtn: {
      alignItems: 'center',
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    outlineBtnText: { fontSize: rnType.label.size, color: tk.text.primary },
    btnDisabled: { opacity: 0.4 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.error.bg,
    },
    errorText: { flex: 1, fontSize: rnType.label.size, color: tk.error.text },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
