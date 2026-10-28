// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type {
  PlanDocument,
  PlanPriority,
  PlanProgressStats,
  PlanStep,
  PlanStepStatus,
} from '@ihui/shared/plan'
import { PLAN_PRIORITY_OPTIONS, PLAN_STEP_STATUS_OPTIONS } from '@ihui/shared/plan'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createPlanStyles, PLAN_PALETTE } from './plan-styles'
import { PlanProgressBlock, formatDate } from './PlanListScreen'
import {
  PRIORITY_LABEL_KEYS,
  PlanFormScreen,
  STEP_STATUS_LABEL_KEYS,
  type PlanFormValues,
} from './PlanFormScreen'
import {
  diffPlanVersions,
  snapshotPlan,
  type PlanStepChangeKind,
  type PlanStepFieldKey,
  type PlanVersionSnapshot,
} from './plan-version-core'

export interface PlanDetailScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  plan: PlanDocument | null
  stats: PlanProgressStats | null
  /** 历史版本(按轮,升序);薄壳负责记录与持久化,本屏纯展示 */
  versions: PlanVersionSnapshot[]
  /** null = 正在看最新(实时 plan),数字 = 正在看历史某轮(只读) */
  selectedVersion: number | null
  onSelectVersion: (version: number | null) => void
  onPlanStatusChange: (status: PlanDocument['status']) => void
  onStepStatusChange: (stepId: string, status: PlanStepStatus) => void
  onStepPriorityChange: (stepId: string, priority: PlanPriority) => void
  onMoveStep: (stepId: string, dir: -1 | 1) => void
  onRemoveStep: (stepId: string) => void
  onAddStep: () => void
  onEditSubmit: (values: PlanFormValues) => void
  onDelete: () => void
}

const PLAN_STATUS_KEYS: Record<PlanDocument['status'], string> = {
  draft: 'planPage.statusDraft',
  active: 'planPage.statusActive',
  completed: 'planPage.statusCompleted',
  archived: 'planPage.statusArchived',
}

const PLAN_STATUS_ORDER: PlanDocument['status'][] = ['draft', 'active', 'completed', 'archived']

const FIELD_LABEL_KEYS: Record<PlanStepFieldKey, string> = {
  title: 'planPage.diffFieldTitle',
  description: 'planPage.diffFieldDescription',
  status: 'planPage.diffFieldStatus',
  priority: 'planPage.diffFieldPriority',
  order: 'planPage.diffFieldOrder',
}

const KIND_LABEL_KEYS: Record<PlanStepChangeKind, string> = {
  added: 'planPage.kindAdded',
  removed: 'planPage.kindRemoved',
  modified: 'planPage.kindModified',
  unchanged: 'planPage.kindUnchanged',
}

const DIFF_SUMMARY_KEYS: Record<PlanStepChangeKind, string> = {
  added: 'planPage.diffAdded',
  removed: 'planPage.diffRemoved',
  modified: 'planPage.diffModified',
  unchanged: 'planPage.diffUnchanged',
}

/** noticeBox 内「回到最新」文字色(与 PLAN_PALETTE.amber.fg 同档,复用不另取色)。 */
const AMBER_TEXT = PLAN_PALETTE.archived.fg

function nextIn<T extends string>(options: readonly T[], current: T): T {
  const idx = options.indexOf(current)
  return options[(idx + 1) % options.length] ?? current
}

/**
 * 计划详情共享屏 —— 对齐 web apps/web/app/(main)/plan/[id]/PageClient.tsx:
 * 头部(编辑/删除+确认)、状态切换、目标/范围/约束/标签、进度统计、
 * 历史版本切换器 + 跨版本 diff、步骤清单(状态/优先级/排序/增删)。
 *
 * 版本历史为简化承载:对比面板固定「选中轮(或最近一轮) vs 当前实时」,
 * 未复刻 web 的 from/to 双选弹窗;其余记录/去重/只读语义与 web 同源。
 */
export function PlanDetailScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  plan,
  stats,
  versions,
  selectedVersion,
  onSelectVersion,
  onPlanStatusChange,
  onStepStatusChange,
  onStepPriorityChange,
  onMoveStep,
  onRemoveStep,
  onAddStep,
  onEditSubmit,
  onDelete,
}: PlanDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createPlanStyles(tk), [tk])
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)

  const headerTitle = plan ? plan.title : t('planPage.title')

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {headerTitle}
      </Text>
      <View style={styles.headerSpacer} />
      {plan ? (
        <>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('planPage.edit')}
            onPress={() => setEditing(true)}
          >
            <Text style={[styles.headerBtnText, { color: tk.text.secondary }]}>
              {t('planPage.edit')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('planPage.delete')}
            onPress={() => setConfirmOpen(true)}
          >
            <Text style={[styles.headerBtnText, { color: tk.error.text }]}>
              {t('planPage.delete')}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  )

  if (loading && !plan) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.skeletonTitle} />
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
          </View>
        </ScrollView>
      </View>
    )
  }

  if (!plan) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t('planPage.notFoundTitle')}</Text>
              <Text style={styles.emptyDesc}>{t('planPage.notFoundDesc')}</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={onBack}
              >
                <Text style={styles.primaryBtnText}>{t('planPage.backToList')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  if (editing) {
    // 编辑态整屏交给表单屏(其自带页头,与 web 端编辑视图替换式布局同构)
    return (
      <PlanFormScreen
        t={t}
        colorScheme={colorScheme}
        onBack={() => setEditing(false)}
        heading={t('planPage.editHeading')}
        initial={{
          title: plan.title,
          goal: plan.goal,
          scope: plan.scope,
          constraints: plan.constraints,
          tags: plan.tags ?? [],
          steps: plan.steps.map((s) => ({
            title: s.title,
            description: s.description,
            status: s.status,
            priority: s.priority,
            estimatedMinutes: s.estimatedMinutes,
          })),
        }}
        submitLabel={t('planPage.saveChanges')}
        onSubmit={(values) => {
          onEditSubmit(values)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const selectedSnap =
    selectedVersion === null ? null : (versions.find((v) => v.version === selectedVersion) ?? null)
  const viewingHistory = selectedSnap !== null
  const displaySteps: PlanStep[] = selectedSnap === null ? plan.steps : selectedSnap.steps
  const liveSnapshot = snapshotPlan(plan, (versions.at(-1)?.version ?? 0) + 1)
  const diffFrom = selectedSnap ?? (versions.length > 0 ? (versions.at(-1) ?? null) : null)
  const diff = diffFrom !== null ? diffPlanVersions(diffFrom, liveSnapshot) : null

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        {confirmOpen ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              {t('planPage.deleteConfirmTitle', { name: plan.title })}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => setConfirmOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>{t('planPage.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: tk.error.text }]}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => {
                  setConfirmOpen(false)
                  onDelete()
                }}
              >
                <Text style={styles.primaryBtnText}>{t('planPage.confirmAction')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.chipRow}>
            {PLAN_STATUS_ORDER.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, plan.status === s && styles.chipActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('planPage.planStatusLabel')}
                onPress={() => onPlanStatusChange(s)}
              >
                <Text style={[styles.chipText, plan.status === s && styles.chipTextActive]}>
                  {t(PLAN_STATUS_KEYS[s])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {t('planPage.createdLabel')} {formatDate(plan.createdAt)}
            </Text>
            <Text style={styles.metaText}>
              {t('planPage.updatedLabel')} {formatDate(plan.updatedAt)}
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text style={styles.fieldLabel}>{t('planPage.fieldGoal')}</Text>
              <Text style={styles.fieldContent}>{plan.goal}</Text>
            </View>
            {plan.scope.length > 0 ? (
              <View style={{ gap: 2 }}>
                <Text style={styles.fieldLabel}>{t('planPage.fieldScope')}</Text>
                <Text style={styles.fieldContent}>{plan.scope}</Text>
              </View>
            ) : null}
            {plan.constraints.length > 0 ? (
              <View style={{ gap: 2 }}>
                <Text style={styles.fieldLabel}>{t('planPage.fieldConstraints')}</Text>
                <Text style={styles.fieldContent}>{plan.constraints}</Text>
              </View>
            ) : null}
            {plan.tags && plan.tags.length > 0 ? (
              <View style={styles.tagRow}>
                <Text style={styles.fieldLabel}>{t('planPage.fieldTags')}</Text>
                {plan.tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          {stats ? <PlanProgressBlock stats={stats} t={t} styles={styles} /> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>
              {t('planPage.versionsHeading')}
              {versions.length > 0 ? ` · ${versions.length}` : ''}
            </Text>
            <TouchableOpacity
              style={[styles.secondaryBtn, versions.length === 0 && styles.iconBtnDisabled]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('planPage.compare')}
              disabled={versions.length === 0}
              onPress={() => setDiffOpen((o) => !o)}
            >
              <Text style={styles.secondaryBtnText}>{t('planPage.compare')}</Text>
            </TouchableOpacity>
          </View>

          {versions.length === 0 ? (
            <View style={{ gap: 2 }}>
              <Text style={styles.emptyTitle}>{t('planPage.versionsEmpty')}</Text>
              <Text style={styles.emptyDesc}>{t('planPage.versionsEmptyHint')}</Text>
            </View>
          ) : (
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, selectedVersion === null && styles.chipActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => onSelectVersion(null)}
              >
                <Text style={[styles.chipText, selectedVersion === null && styles.chipTextActive]}>
                  {t('planPage.latest')}
                </Text>
              </TouchableOpacity>
              {versions.map((v) => (
                <TouchableOpacity
                  key={v.version}
                  style={[styles.chip, selectedVersion === v.version && styles.chipActive]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  onPress={() => onSelectVersion(v.version)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedVersion === v.version && styles.chipTextActive,
                    ]}
                  >
                    {t('planPage.roundLabel', { version: v.version })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {viewingHistory ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                {t('planPage.viewingHistory', { version: selectedVersion ?? 0 })}
              </Text>
              <TouchableOpacity
                style={styles.headerBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => onSelectVersion(null)}
              >
                <Text style={[styles.headerBtnText, { color: AMBER_TEXT }]}>
                  {t('planPage.backToLatest')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {diffOpen && diff !== null ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.cardTitle}>{t('planPage.compareHeading')}</Text>
              <View style={styles.diffSummaryRow}>
                {(
                  [
                    ['added', diff.summary.added],
                    ['removed', diff.summary.removed],
                    ['modified', diff.summary.modified],
                    ['unchanged', diff.summary.unchanged],
                  ] as const
                ).map(([kind, count]) => (
                  <View
                    key={kind}
                    style={[styles.badge, { backgroundColor: PLAN_PALETTE[kind].bg }]}
                  >
                    <Text style={[styles.badgeText, { color: PLAN_PALETTE[kind].fg }]}>
                      {t(DIFF_SUMMARY_KEYS[kind], { count })}
                    </Text>
                  </View>
                ))}
              </View>
              {diff.goalChanged || diff.scopeChanged ? (
                <Text style={styles.metaText}>
                  {[
                    diff.goalChanged ? t('planPage.diffGoalChanged') : null,
                    diff.scopeChanged ? t('planPage.diffScopeChanged') : null,
                  ]
                    .filter((s): s is string => s !== null)
                    .join(' · ')}
                </Text>
              ) : null}
              {diff.changes.length === 0 ? (
                <Text style={styles.emptyDesc}>{t('planPage.diffNoChanges')}</Text>
              ) : (
                diff.changes.map((change) => (
                  <View
                    key={`${change.kind}-${change.stepId}`}
                    style={[
                      styles.diffChangeRow,
                      { borderLeftColor: PLAN_PALETTE[change.kind].dot },
                    ]}
                  >
                    <View style={styles.cardHead}>
                      <Text style={styles.diffChangeTitle} numberOfLines={1}>
                        {change.title}
                      </Text>
                      <Text
                        style={[styles.diffChangeKind, { color: PLAN_PALETTE[change.kind].fg }]}
                      >
                        {t(KIND_LABEL_KEYS[change.kind])}
                      </Text>
                    </View>
                    <Text style={styles.diffChangeDetail}>
                      {change.kind === 'modified'
                        ? t('planPage.diffFieldsChanged', {
                            fields: change.fields.map((f) => t(FIELD_LABEL_KEYS[f])).join(', '),
                          })
                        : change.kind === 'added'
                          ? t('planPage.diffAddedThisRound')
                          : change.kind === 'removed'
                            ? t('planPage.diffRemovedThisRound')
                            : t('planPage.diffNoChange')}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>
              {t('planPage.stepsHeading', { count: displaySteps.length })}
            </Text>
            {!viewingHistory ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('planPage.addStep')}
                onPress={onAddStep}
              >
                <Plus size={13} color={tk.text.secondary} strokeWidth={2.2} />
                <Text style={styles.secondaryBtnText}>{t('planPage.addStep')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {displaySteps.length === 0 ? (
            <Text style={styles.emptyDesc}>{t('planPage.stepEmpty')}</Text>
          ) : (
            displaySteps.map((step, i) => {
              const statusPalette = PLAN_PALETTE[step.status]
              const priorityPalette = PLAN_PALETTE[step.priority]
              return (
                <View key={step.id} style={styles.stepCard}>
                  <View style={styles.stepHead}>
                    <View style={styles.stepIndex}>
                      <Text style={styles.stepIndexText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    {!viewingHistory ? (
                      <View style={styles.stepFoot}>
                        <TouchableOpacity
                          style={[styles.iconBtn, i === 0 && styles.iconBtnDisabled]}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={t('planPage.moveUp')}
                          disabled={i === 0}
                          onPress={() => onMoveStep(step.id, -1)}
                        >
                          <ChevronUp size={15} color={tk.text.secondary} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.iconBtn,
                            i === displaySteps.length - 1 && styles.iconBtnDisabled,
                          ]}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={t('planPage.moveDown')}
                          disabled={i === displaySteps.length - 1}
                          onPress={() => onMoveStep(step.id, 1)}
                        >
                          <ChevronDown size={15} color={tk.text.secondary} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={t('planPage.removeStep')}
                          onPress={() => onRemoveStep(step.id)}
                        >
                          <Trash2 size={14} color={tk.error.text} strokeWidth={2} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  {step.description.length > 0 ? (
                    <Text style={styles.stepDesc}>{step.description}</Text>
                  ) : null}
                  <View style={styles.stepBadges}>
                    <TouchableOpacity
                      style={[styles.badge, { backgroundColor: statusPalette.bg }]}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={t('planPage.stepStatusLabel')}
                      disabled={viewingHistory}
                      onPress={() =>
                        onStepStatusChange(
                          step.id,
                          nextIn(
                            PLAN_STEP_STATUS_OPTIONS.map((o) => o.value),
                            step.status,
                          ),
                        )
                      }
                    >
                      <Text style={[styles.badgeText, { color: statusPalette.fg }]}>
                        {t(STEP_STATUS_LABEL_KEYS[step.status])}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.badge, { backgroundColor: priorityPalette.bg }]}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={t('planPage.stepPriorityLabel')}
                      disabled={viewingHistory}
                      onPress={() =>
                        onStepPriorityChange(
                          step.id,
                          nextIn(
                            PLAN_PRIORITY_OPTIONS.map((o) => o.value),
                            step.priority,
                          ),
                        )
                      }
                    >
                      <Text style={[styles.badgeText, { color: priorityPalette.fg }]}>
                        {t(PRIORITY_LABEL_KEYS[step.priority])}
                      </Text>
                    </TouchableOpacity>
                    {step.estimatedMinutes !== undefined && step.estimatedMinutes > 0 ? (
                      <Text style={styles.metaText}>
                        {t('planPage.estimatedMinutes', { minutes: step.estimatedMinutes })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
