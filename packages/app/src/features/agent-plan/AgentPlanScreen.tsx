// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ban, Check, CircleX, FileText, Pencil, RotateCcw, Sparkles, X } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'agentPlanPage'

/** 三阶段与 web AgentPlanStudio 同构(apps/web/src/components/agent-plan/AgentPlanStudio.tsx:21) */
export type AgentPlanPhase = 'input' | 'plan' | 'result'

export interface AgentPlanResultView {
  stopReason: string
  iterations: string
  error: string | null
  finalResponse: string
}

export interface AgentPlanScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  phase: AgentPlanPhase
  goal: string
  sessionId: string
  model: string
  onGoalChange: (value: string) => void
  onSessionIdChange: (value: string) => void
  onModelChange: (value: string) => void
  /** 生成中 / 决策执行中(web busy 同义) */
  busy: boolean
  error: string | null
  planId: string | null
  planMd: string
  readonlyTools: string[]
  /** 薄壳按 detail.status 注入的状态文案说明(web StatusBadge 同语义) */
  statusText: string
  status: string
  editing: boolean
  editedMd: string
  onEditedMdChange: (value: string) => void
  onToggleEdit: () => void
  result: AgentPlanResultView | null
  rejected: boolean
  onGenerate: () => void
  onApprove: () => void
  onReject: () => void
  onReset: () => void
}

/**
 * Agent Plan 计划模式共享屏 —— 承载 web /agent-plan(apps/web/app/(main)/agent-plan/page.tsx
 * → AgentPlanStudio)。
 *
 * 端点与 web 同一封装:packages/api-client/src/endpoints/agent-plan.ts(POST /api/agent-plan 创建、
 * GET /api/agent-plan/{id} 查询、POST /api/agent-plan/{id}/decision 批准/拒绝);后端实现在
 * apps/ai-service/app/routers/agent_plan.py:241/259/399,响应信封统一 {code,message,data}。
 * **如实登记**:apps/api 全仓无 /api/agent-plan 前缀注册(该前缀由 web next rewrites 直转 8803,
 * apps/web/next.config.ts:320 —— RN 侧同样依赖网关转发,apps/api 缺该注册面)。
 *
 * 三阶段与 web 同序(输入 → 计划审阅/编辑 → 结果),平台无关:取数、登录态、决策阻塞时长由薄壳注入。
 */
export function AgentPlanScreen({
  t,
  colorScheme,
  onBack,
  phase,
  goal,
  sessionId,
  model,
  onGoalChange,
  onSessionIdChange,
  onModelChange,
  busy,
  error,
  planId,
  planMd,
  readonlyTools,
  statusText,
  status,
  editing,
  editedMd,
  onEditedMdChange,
  onToggleEdit,
  result,
  rejected,
  onGenerate,
  onApprove,
  onReject,
  onReset,
}: AgentPlanScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = createStyles(tk)
  const canSubmit = goal.trim().length > 0 && !busy
  const toneColor =
    status === 'failed' || status === 'rejected'
      ? tk.danger.DEFAULT
      : status === 'done'
        ? tk.success.deepText
        : tk.text.secondary

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <FileText size={20} color={tk.brand.DEFAULT} />
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
        </View>
        <Text style={styles.description}>{t(`${NS}.description`)}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <CircleX size={16} color={tk.danger.DEFAULT} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {busy && phase === 'input' ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
            <Text style={styles.muted}>{t(`${NS}.generating`)}</Text>
          </View>
        ) : null}

        {phase === 'input' ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t(`${NS}.goalLabel`)}</Text>
            <TextInput
              style={[styles.textArea]}
              value={goal}
              onChangeText={onGoalChange}
              placeholder={t(`${NS}.goalPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              multiline
              editable={!busy}
            />
            <Text style={styles.label}>{t(`${NS}.sessionLabel`)}</Text>
            <TextInput
              style={styles.textArea}
              value={sessionId}
              onChangeText={onSessionIdChange}
              placeholder={t(`${NS}.sessionPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              editable={!busy}
            />
            <Text style={styles.label}>{t(`${NS}.modelLabel`)}</Text>
            <TextInput
              style={styles.textArea}
              value={model}
              onChangeText={onModelChange}
              placeholder={t(`${NS}.modelPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              editable={!busy}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
              onPress={onGenerate}
              disabled={!canSubmit}
            >
              <Sparkles size={16} color={tk.brand.ctaForeground} />
              <Text style={styles.primaryBtnText}>
                {busy ? t(`${NS}.generating`) : t(`${NS}.generate`)}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {phase === 'plan' ? (
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={[styles.badge, { color: toneColor }]}>{statusText}</Text>
              {planId ? (
                <Text style={styles.mono} numberOfLines={1}>
                  {planId.slice(0, 8)}…
                </Text>
              ) : null}
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t(`${NS}.planTitle`)}</Text>
              {!busy ? (
                <TouchableOpacity style={styles.ghostBtn} onPress={onToggleEdit}>
                  {editing ? (
                    <X size={14} color={tk.text.secondary} />
                  ) : (
                    <Pencil size={14} color={tk.text.secondary} />
                  )}
                  <Text style={styles.ghostBtnText}>
                    {editing ? t(`${NS}.cancel`) : t(`${NS}.edit`)}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {editing ? (
              <TextInput
                style={[styles.textArea, styles.planArea]}
                value={editedMd}
                onChangeText={onEditedMdChange}
                multiline
                placeholderTextColor={tk.text.tertiary}
              />
            ) : planMd ? (
              <Text style={styles.planText}>{planMd}</Text>
            ) : (
              <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
            )}
            {editing ? <Text style={styles.hint}>{t(`${NS}.editHint`)}</Text> : null}

            <Text style={styles.label}>{t(`${NS}.readonlyTools`)}</Text>
            <View style={styles.toolRow}>
              {readonlyTools.length === 0 ? (
                <Text style={styles.muted}>—</Text>
              ) : (
                readonlyTools.map((tool) => (
                  <Text key={tool} style={styles.toolChip}>
                    {tool}
                  </Text>
                ))
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={onApprove}
                disabled={busy}
              >
                <Check size={16} color={tk.brand.ctaForeground} />
                <Text style={styles.primaryBtnText}>
                  {busy ? t(`${NS}.executing`) : t(`${NS}.approve`)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, busy && styles.btnDisabled]}
                onPress={onReject}
                disabled={busy}
              >
                <Ban size={16} color={tk.text.secondary} />
                <Text style={styles.outlineBtnText}>{t(`${NS}.reject`)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {phase === 'result' ? (
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={[styles.badge, { color: toneColor }]}>{statusText}</Text>
            </View>
            {rejected ? (
              <View style={styles.resultBox}>
                <Text style={styles.sectionTitle}>{t(`${NS}.rejectedTitle`)}</Text>
                <Text style={styles.muted}>{t(`${NS}.rejectedDesc`)}</Text>
              </View>
            ) : result ? (
              <>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.stopReason`)}</Text>
                  <Text style={styles.fieldValue}>{result.stopReason || '—'}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.iterations`)}</Text>
                  <Text style={styles.fieldValue}>{result.iterations}</Text>
                </View>
                {result.error ? (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t(`${NS}.errorLabel`)}</Text>
                    <Text style={styles.fieldValue}>{result.error}</Text>
                  </View>
                ) : null}
                <View style={styles.resultBox}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.finalResponse`)}</Text>
                  <Text style={styles.planText}>{result.finalResponse || '—'}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
            )}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={onReset}>
                <RotateCcw size={16} color={tk.text.secondary} />
                <Text style={styles.outlineBtnText}>{t(`${NS}.reset`)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: rnSpacing.md },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: rnSpacing['2xl'] },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    description: {
      marginTop: rnSpacing.xs,
      marginBottom: rnSpacing.md,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.error.bg,
    },
    errorText: { flex: 1, fontSize: rnType.label.size, color: tk.error.text },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    label: { fontSize: rnType.caption.size, fontWeight: '500', color: tk.text.secondary },
    textArea: {
      minHeight: 44,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    planArea: { minHeight: 180, textAlignVertical: 'top' },
    planText: { fontSize: rnType.caption.size, color: tk.text.primary, lineHeight: 18 },
    hint: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      fontWeight: '500',
      overflow: 'hidden',
    },
    mono: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    sectionTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ghostBtnText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    toolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    toolChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      overflow: 'hidden',
    },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm, marginTop: rnSpacing.sm },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.ctaForeground },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    outlineBtnText: { fontSize: rnType.label.size, color: tk.text.primary },
    btnDisabled: { opacity: 0.4 },
    resultBox: {
      gap: rnSpacing.xs,
      padding: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    fieldValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
