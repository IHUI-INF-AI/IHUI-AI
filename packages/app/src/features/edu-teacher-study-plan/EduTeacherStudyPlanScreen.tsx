// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type {
  EduTeacherClass,
  EduTeacherPlanForm,
  EduTeacherPlanItem,
  EduTeacherStudyPlan,
  EduTeacherStudyPlanScreenProps,
  EduTeacherTerm,
} from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'

export type {
  EduTeacherClass,
  EduTeacherPlanForm,
  EduTeacherPlanItem,
  EduTeacherStudyPlan,
  EduTeacherStudyPlanScreenProps,
  EduTeacherTerm,
}

/** 计划类型 → 取词键(模块层只存键名,禁在求值期调 t) */
const PLAN_TYPE_KEY: Record<string, string> = {
  monthly: 'eduTeacherStudyPlan.planTypeMonthly',
  weekly: 'eduTeacherStudyPlan.planTypeWeekly',
}

/** 已知状态档 → 取词键;未知档(服务端未约束 status)在渲染处原样回显 */
const PLAN_STATUS_KEY: Record<string, string> = {
  draft: 'eduTeacherStudyPlan.statusDraft',
  active: 'eduTeacherStudyPlan.statusActive',
  completed: 'eduTeacherStudyPlan.statusCompleted',
  archived: 'eduTeacherStudyPlan.statusArchived',
}

/** 状态切换候选(与 web `STATUS_ORDER` 同序) */
const PLAN_STATUS_ORDER = ['draft', 'active', 'completed', 'archived'] as const

/** 计划类型候选(后端 `z.enum(['monthly','weekly'])`) */
const PLAN_TYPE_ORDER = ['monthly', 'weekly'] as const

/** `YYYY-MM-DD` 或 ISO 串统一取日期段;空值给空串(不留 "-" 假占位) */
function dayOf(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

/** 状态徽章配色:语义 token 三档,零 hex */
function badgeTone(tk: AppThemeTokens, status: string): { bg: string; fg: string } {
  if (status === 'active') return { bg: tk.brandAccent.light, fg: tk.brandAccent.deep }
  if (status === 'completed') return { bg: tk.success.light, fg: tk.success.deepText }
  if (status === 'archived') return { bg: tk.surface.muted, fg: tk.text.tertiary }
  return { bg: tk.surface.muted, fg: tk.text.secondary }
}

/**
 * 教师侧学习计划编排屏(共享层)——
 * 承载 web `/edu/edu-management/study-plan`
 * (`apps/web/app/(main)/edu/edu-management/study-plan/StudyPlanPage.tsx`)的可编排面:
 *
 * - 结构:顶栏(返回)→ 学期/班级选择 + 新建计划 → 计划列表(月计划折叠其拆解出的周计划)
 *   → 选中计划详情(状态切换 / 自动拆解 / 条目勾选)
 * - 受控:所有数据、提交、错误文案由宿主注入;本屏只持有「弹层开合」这一类纯视状态
 *   (picker / 删除二次确认),业务状态一律不落这里
 * - 与家长端 `EduChildStudyPlansScreen` **非同物**:那屏只读家长可见的计划表,
 *   无学期/班级维度、无创建/拆解,故不复用
 * - 日期:RN 无日期选择器依赖,起止日期按 `YYYY-MM-DD` 文本录入(web 用 `<input type="date">`,
 *   提交契约同为字符串,故不引入新依赖)
 * - 样式:getTokens(colorScheme) 语义 token,零 hex,间距走 rnSpacing/rnType/rnRadius
 * - i18n:eduTeacherStudyPlan.*(新增)+ 复用 common.back/cancel/save/loading/retry
 */
export function EduTeacherStudyPlanScreen({
  t,
  terms,
  classes,
  plans,
  items,
  selectedTermId,
  selectedClassId,
  selectedPlanId,
  form,
  editingPlanId,
  loading,
  classesLoading = false,
  itemsLoading = false,
  saving,
  deletingPlanId = null,
  splittingPlanId = null,
  error = '',
  notice = '',
  onBack,
  onRetry,
  onSelectTerm,
  onSelectClass,
  onSelectPlan,
  onOpenCreate,
  onOpenEdit,
  onCloseForm,
  onFormChange,
  onSubmitForm,
  onDeletePlan,
  onAutoSplit,
  onUpdateStatus,
  onToggleItem,
  colorScheme = 'light',
}: EduTeacherStudyPlanScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [picker, setPicker] = useState<'term' | 'class' | null>(null)
  /** 删除二次确认:只认同一个计划 id,点别处自动失效 */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? null
  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null

  const parentPlans = useMemo(() => plans.filter((plan) => !plan.parentPlanId), [plans])
  const childrenByParent = useMemo(() => {
    const map = new Map<string, EduTeacherStudyPlan[]>()
    for (const plan of plans) {
      if (!plan.parentPlanId) continue
      const list = map.get(plan.parentPlanId) ?? []
      list.push(plan)
      map.set(plan.parentPlanId, list)
    }
    for (const [, list] of map) list.sort((a, b) => a.startDate.localeCompare(b.startDate))
    return map
  }, [plans])

  const parentItems = useMemo(() => items.filter((item) => !item.parentItemId), [items])
  const totalCount = parentItems.length
  const completedCount = parentItems.filter((item) => item.completed).length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const canPickClass = Boolean(selectedTermId)
  const canCreate = Boolean(selectedTermId && selectedClassId)

  const planTypeLabel = (planType: string): string => {
    const key = PLAN_TYPE_KEY[planType]
    return key ? t(key) : planType
  }
  const statusLabel = (status: string): string => {
    const key = PLAN_STATUS_KEY[status]
    return key ? t(key) : status
  }
  const childPlansOf = (planId: string): EduTeacherStudyPlan[] => childrenByParent.get(planId) ?? []
  const isUnsplitted = (plan: EduTeacherStudyPlan): boolean =>
    plan.planType === 'monthly' && childPlansOf(plan.id).length === 0
  const rangeText = (plan: EduTeacherStudyPlan): string =>
    `${dayOf(plan.startDate)} ~ ${dayOf(plan.endDate)}`

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('eduTeacherStudyPlan.title')}</Text>
      {/* 右侧占位:与返回键等宽,标题才是真居中 */}
      <View style={styles.headerSpacer} />
    </View>
  )

  if (loading && terms.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && terms.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const formOpen = form !== null

  return (
    <View style={styles.container}>
      {header}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('eduTeacherStudyPlan.subtitle')}</Text>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error && !formOpen ? (
          /* 有数据时的错误不走整屏错误态(不抖掉已读列表),但必须给出口 —— 否则只能杀进程重进 */
          <View style={styles.errorRow}>
            <Text style={styles.errorText} accessibilityRole="text">
              {error}
            </Text>
            <TouchableOpacity
              style={styles.errorRetry}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry')}
            >
              <Text style={styles.errorRetryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── 学期 / 班级 / 新建 ── */}
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.termLabel')}</Text>
          <TouchableOpacity
            style={styles.selectRow}
            onPress={() => setPicker('term')}
            accessibilityRole="button"
          >
            <Text style={selectedTerm ? styles.selectValue : styles.selectPlaceholder}>
              {selectedTerm
                ? `${selectedTerm.name}${selectedTerm.isCurrent ? t('eduTeacherStudyPlan.currentTermSuffix') : ''}`
                : t('eduTeacherStudyPlan.selectTerm')}
            </Text>
            <Text style={styles.selectHint}>{t('eduTeacherStudyPlan.select')}</Text>
          </TouchableOpacity>

          <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.classLabel')}</Text>
          <TouchableOpacity
            style={[styles.selectRow, canPickClass ? null : styles.selectRowDisabled]}
            onPress={() => (canPickClass ? setPicker('class') : undefined)}
            disabled={!canPickClass}
            accessibilityRole="button"
          >
            <Text style={selectedClass ? styles.selectValue : styles.selectPlaceholder}>
              {classesLoading
                ? t('common.loading')
                : selectedClass
                  ? `${selectedClass.name}${selectedClass.grade ? ` (${selectedClass.grade})` : ''}`
                  : canPickClass
                    ? t('eduTeacherStudyPlan.selectClass')
                    : t('eduTeacherStudyPlan.selectTermFirst')}
            </Text>
            <Text style={styles.selectHint}>{t('eduTeacherStudyPlan.select')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createBtn, canCreate ? null : styles.btnDisabled]}
            onPress={onOpenCreate}
            disabled={!canCreate}
            accessibilityRole="button"
          >
            <Text style={styles.createBtnText}>{t('eduTeacherStudyPlan.createPlan')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── 计划列表 ── */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('eduTeacherStudyPlan.planListTitle')}</Text>
          {parentPlans.length > 0 ? (
            <Text style={styles.sectionCount}>
              {t('eduTeacherStudyPlan.planCount', { count: parentPlans.length })}
            </Text>
          ) : null}
        </View>

        {parentPlans.length === 0 ? (
          <Text style={styles.emptyText}>
            {selectedClassId
              ? t('eduTeacherStudyPlan.noPlans')
              : t('eduTeacherStudyPlan.selectClassFirst')}
          </Text>
        ) : (
          parentPlans.map((plan) => {
            const tone = badgeTone(tk, plan.status)
            const children = childPlansOf(plan.id)
            const active = plan.id === selectedPlanId
            return (
              <View key={plan.id} style={styles.planBlock}>
                <TouchableOpacity
                  style={[styles.planCard, active ? styles.planCardActive : null]}
                  onPress={() => {
                    setConfirmingId(null)
                    onSelectPlan(plan.id)
                  }}
                  accessibilityRole="button"
                >
                  <View style={styles.planHead}>
                    <Text
                      style={[
                        styles.planTitle,
                        plan.status === 'completed' ? styles.planTitleDone : null,
                      ]}
                      numberOfLines={2}
                    >
                      {plan.title}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>
                        {statusLabel(plan.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaChip}>{planTypeLabel(plan.planType)}</Text>
                    {isUnsplitted(plan) ? (
                      <Text style={[styles.metaChip, styles.metaChipWarn]}>
                        {t('eduTeacherStudyPlan.unsplitted')}
                      </Text>
                    ) : null}
                    <Text style={styles.metaText}>{rangeText(plan)}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => onOpenEdit(plan)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionText}>{t('eduTeacherStudyPlan.edit')}</Text>
                    </TouchableOpacity>
                    {isUnsplitted(plan) ? (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          splittingPlanId === plan.id ? styles.btnDisabled : null,
                        ]}
                        onPress={() => onAutoSplit(plan)}
                        disabled={splittingPlanId === plan.id}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionText}>
                          {splittingPlanId === plan.id
                            ? t('eduTeacherStudyPlan.splitting')
                            : t('eduTeacherStudyPlan.autoSplit')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {confirmingId === plan.id ? (
                      <>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionDanger]}
                          onPress={() => {
                            setConfirmingId(null)
                            onDeletePlan(plan)
                          }}
                          disabled={deletingPlanId === plan.id}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.actionText, styles.actionDangerText]}>
                            {deletingPlanId === plan.id
                              ? t('eduTeacherStudyPlan.deleting')
                              : t('eduTeacherStudyPlan.deleteConfirm')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => setConfirmingId(null)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.actionText}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => setConfirmingId(plan.id)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionText}>{t('eduTeacherStudyPlan.delete')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {children.map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childRow,
                      child.id === selectedPlanId ? styles.childRowActive : null,
                    ]}
                    onPress={() => onSelectPlan(child.id)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.childTitle} numberOfLines={1}>
                      {child.title}
                    </Text>
                    <Text style={styles.childMeta}>{rangeText(child)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )
          })
        )}

        {/* ── 选中计划详情 ── */}
        {selectedPlan ? (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle} numberOfLines={2}>
              {selectedPlan.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaChip}>{planTypeLabel(selectedPlan.planType)}</Text>
              <Text style={styles.metaText}>{rangeText(selectedPlan)}</Text>
            </View>
            {selectedPlan.description ? (
              <Text style={styles.detailDesc}>{selectedPlan.description}</Text>
            ) : null}
            {totalCount > 0 ? (
              <Text style={styles.progress}>
                {t('eduTeacherStudyPlan.completionProgress', {
                  completed: completedCount,
                  total: totalCount,
                  rate: completionRate,
                })}
              </Text>
            ) : null}

            <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.statusLabel')}</Text>
            <View style={styles.statusRow}>
              {PLAN_STATUS_ORDER.map((status) => {
                const current = selectedPlan.status === status
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusChip, current ? styles.statusChipActive : null]}
                    onPress={() => onUpdateStatus(selectedPlan, status)}
                    disabled={current || saving}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.statusChipText, current ? styles.statusChipTextActive : null]}
                    >
                      {statusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {isUnsplitted(selectedPlan) ? (
              <TouchableOpacity
                style={[
                  styles.splitBtn,
                  splittingPlanId === selectedPlan.id ? styles.btnDisabled : null,
                ]}
                onPress={() => onAutoSplit(selectedPlan)}
                disabled={splittingPlanId === selectedPlan.id}
                accessibilityRole="button"
              >
                <Text style={styles.splitBtnText}>
                  {splittingPlanId === selectedPlan.id
                    ? t('eduTeacherStudyPlan.splitting')
                    : t('eduTeacherStudyPlan.autoSplit')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.filterLabel}>
              {t('eduTeacherStudyPlan.planItems')}
              {totalCount > 0
                ? ` ${t('eduTeacherStudyPlan.itemCount', { count: totalCount })}`
                : ''}
            </Text>
            {itemsLoading ? (
              <ActivityIndicator color={tk.brand.DEFAULT} style={styles.itemsLoading} />
            ) : parentItems.length === 0 ? (
              <Text style={styles.emptyText}>{t('eduTeacherStudyPlan.noItems')}</Text>
            ) : (
              parentItems.map((item) => {
                const children = items.filter((child) => child.parentItemId === item.id)
                return (
                  <View key={item.id} style={styles.itemBlock}>
                    <TouchableOpacity
                      style={styles.itemRow}
                      onPress={() => onToggleItem(item)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.completed }}
                    >
                      <View style={[styles.checkbox, item.completed ? styles.checkboxOn : null]}>
                        {item.completed ? <Text style={styles.checkMark}>✓</Text> : null}
                      </View>
                      <View style={styles.itemMain}>
                        <Text
                          style={[styles.itemText, item.completed ? styles.itemTextDone : null]}
                        >
                          {item.content}
                        </Text>
                        {item.objective ? (
                          <Text style={styles.itemMeta}>
                            {t('eduTeacherStudyPlan.objectivePrefix', { value: item.objective })}
                          </Text>
                        ) : null}
                        {item.notes ? (
                          <Text style={styles.itemMeta}>
                            {t('eduTeacherStudyPlan.notesPrefix', { value: item.notes })}
                          </Text>
                        ) : null}
                        {item.dueDate ? (
                          <Text style={styles.itemMeta}>{dayOf(item.dueDate)}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    {children.map((child) => (
                      <TouchableOpacity
                        key={child.id}
                        style={[styles.itemRow, styles.itemRowChild]}
                        onPress={() => onToggleItem(child)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: child.completed }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            styles.checkboxSm,
                            child.completed ? styles.checkboxOn : null,
                          ]}
                        >
                          {child.completed ? <Text style={styles.checkMark}>✓</Text> : null}
                        </View>
                        <View style={styles.itemMain}>
                          <Text
                            style={[
                              styles.itemTextSm,
                              child.completed ? styles.itemTextDone : null,
                            ]}
                          >
                            {child.content}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              })
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>{t('eduTeacherStudyPlan.selectPlanHint')}</Text>
        )}
      </ScrollView>

      {/* ── 学期选择 ── */}
      <Modal
        visible={picker === 'term'}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.modalScrim}
            activeOpacity={1}
            onPress={() => setPicker(null)}
            accessibilityLabel={t('common.close')}
          />
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>{t('eduTeacherStudyPlan.selectTerm')}</Text>
            <ScrollView style={styles.modalList}>
              {terms.length === 0 ? (
                <Text style={styles.emptyText}>{t('eduTeacherStudyPlan.noTerms')}</Text>
              ) : (
                terms.map((term) => (
                  <TouchableOpacity
                    key={term.id}
                    style={[
                      styles.modalItem,
                      term.id === selectedTermId ? styles.modalItemActive : null,
                    ]}
                    onPress={() => {
                      onSelectTerm(term.id)
                      setPicker(null)
                    }}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        term.id === selectedTermId ? styles.modalItemTextActive : null,
                      ]}
                    >
                      {term.name}
                      {term.isCurrent ? t('eduTeacherStudyPlan.currentTermSuffix') : ''}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setPicker(null)}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 班级选择 ── */}
      <Modal
        visible={picker === 'class'}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.modalScrim}
            activeOpacity={1}
            onPress={() => setPicker(null)}
            accessibilityLabel={t('common.close')}
          />
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>{t('eduTeacherStudyPlan.selectClass')}</Text>
            <ScrollView style={styles.modalList}>
              {classesLoading ? (
                <ActivityIndicator color={tk.brand.DEFAULT} style={styles.itemsLoading} />
              ) : classes.length === 0 ? (
                <Text style={styles.emptyText}>{t('eduTeacherStudyPlan.noClasses')}</Text>
              ) : (
                classes.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalItem,
                      item.id === selectedClassId ? styles.modalItemActive : null,
                    ]}
                    onPress={() => {
                      onSelectClass(item.id)
                      setPicker(null)
                    }}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        item.id === selectedClassId ? styles.modalItemTextActive : null,
                      ]}
                    >
                      {item.name}
                      {item.grade ? ` (${item.grade})` : ''}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setPicker(null)}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 计划表单(受控:值在宿主,onFormChange 回写) ── */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={onCloseForm}>
        <View style={styles.modalRoot}>
          {/* 遮罩绝对定位铺底:表单里的 TextInput 不被 scrim 包住,点击才不会被抢焦点 */}
          <TouchableOpacity
            style={styles.modalScrim}
            activeOpacity={1}
            onPress={onCloseForm}
            accessibilityLabel={t('common.close')}
          />
          <KeyboardAvoidingView
            style={styles.formAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            <View style={styles.formPanel}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>
                  {editingPlanId
                    ? t('eduTeacherStudyPlan.editPlanTitle')
                    : t('eduTeacherStudyPlan.createPlanTitle')}
                </Text>

                {error ? (
                  <Text style={styles.error} accessibilityRole="text">
                    {error}
                  </Text>
                ) : null}
                {!canCreate ? (
                  <Text style={styles.error}>{t('eduTeacherStudyPlan.selectClassFirst')}</Text>
                ) : null}

                {form ? (
                  <>
                    <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.planTitle')}</Text>
                    <TextField
                      colorScheme={colorScheme}
                      style={styles.input}
                      value={form.title}
                      onChangeText={(value) => onFormChange('title', value)}
                      placeholder={t('eduTeacherStudyPlan.titlePlaceholder')}
                      placeholderTextColor={tk.text.tertiary}
                      maxLength={200}
                    />

                    <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.planType')}</Text>
                    <View style={styles.statusRow}>
                      {PLAN_TYPE_ORDER.map((planType) => {
                        const current = form.planType === planType
                        return (
                          <TouchableOpacity
                            key={planType}
                            style={[styles.statusChip, current ? styles.statusChipActive : null]}
                            onPress={() => onFormChange('planType', planType)}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.statusChipText,
                                current ? styles.statusChipTextActive : null,
                              ]}
                            >
                              {planTypeLabel(planType)}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>

                    <View style={styles.rowTwo}>
                      <View style={styles.rowCell}>
                        <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.startDate')}</Text>
                        <TextField
                          colorScheme={colorScheme}
                          style={styles.input}
                          value={form.startDate}
                          onChangeText={(value) => onFormChange('startDate', value)}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={tk.text.tertiary}
                          autoCapitalize="none"
                          maxLength={10}
                        />
                      </View>
                      <View style={styles.rowCell}>
                        <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.endDate')}</Text>
                        <TextField
                          colorScheme={colorScheme}
                          style={styles.input}
                          value={form.endDate}
                          onChangeText={(value) => onFormChange('endDate', value)}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={tk.text.tertiary}
                          autoCapitalize="none"
                          maxLength={10}
                        />
                      </View>
                    </View>

                    <Text style={styles.filterLabel}>{t('eduTeacherStudyPlan.description')}</Text>
                    <TextField
                      colorScheme={colorScheme}
                      style={[styles.input, styles.inputMultiline]}
                      value={form.description}
                      onChangeText={(value) => onFormChange('description', value)}
                      placeholder={t('eduTeacherStudyPlan.descriptionPlaceholder')}
                      placeholderTextColor={tk.text.tertiary}
                      multiline
                      textAlignVertical="top"
                    />
                  </>
                ) : null}

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.ghostBtn, styles.rowCell]}
                    onPress={onCloseForm}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, styles.rowCell, saving ? styles.btnDisabled : null]}
                    onPress={onSubmitForm}
                    disabled={saving}
                    accessibilityRole="button"
                  >
                    <Text style={styles.submitBtnText}>
                      {saving
                        ? t('eduTeacherStudyPlan.saving')
                        : editingPlanId
                          ? t('common.save')
                          : t('eduTeacherStudyPlan.create')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    scroll: { paddingHorizontal: rnSpacing.lg, paddingBottom: rnSpacing['3xl'] },
    /* 顶栏 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: { fontSize: rnType.title.size, fontWeight: '500', color: tk.text.primary },
    headerSpacer: { width: 32 },
    subtitle: { fontSize: rnType.label.size, lineHeight: 18, color: tk.text.tertiary },
    notice: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.success.light,
      fontSize: rnType.label.size,
      color: tk.success.deepText,
    },
    error: { marginTop: rnSpacing.sm, fontSize: rnType.label.size, color: tk.error.text },
    /* 内联错误行:文案 + 重试(有数据时的错误不顶整屏,但必须能重试) */
    errorRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
    },
    errorText: { flexShrink: 1, fontSize: rnType.label.size, color: tk.error.text },
    errorRetry: {
      flexShrink: 0,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    errorRetryText: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    /* 选择区 */
    filterCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    filterLabel: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    selectRow: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      backgroundColor: tk.surface.muted,
    },
    selectRowDisabled: { opacity: 0.5 },
    selectValue: { flex: 1, fontSize: rnType.body.size, color: tk.text.primary },
    selectPlaceholder: { flex: 1, fontSize: rnType.body.size, color: tk.text.tertiary },
    selectHint: { fontSize: rnType.caption.size, color: tk.brandAccent.deep },
    createBtn: {
      marginTop: rnSpacing.md,
      minHeight: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    btnDisabled: { opacity: 0.5 },
    /* 计划列表 */
    sectionHead: {
      marginTop: rnSpacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    sectionCount: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    emptyText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
      textAlign: 'center',
      paddingVertical: rnSpacing.lg,
    },
    planBlock: { marginTop: rnSpacing.sm },
    planCard: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    planCardActive: { borderColor: tk.brandAccent.deep },
    planHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    planTitle: {
      flex: 1,
      flexShrink: 1,
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    planTitleDone: { color: tk.text.tertiary, textDecorationLine: 'line-through' },
    badge: {
      flexShrink: 0,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
    },
    badgeText: { fontSize: rnType.caption.size, fontWeight: '600' },
    metaRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    metaChipWarn: {
      borderColor: tk.warning.amber,
      color: tk.warning.amberText,
      backgroundColor: tk.warning.light,
    },
    metaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    actionRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    actionBtn: {
      minHeight: 28,
      justifyContent: 'center',
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    actionText: { fontSize: rnType.caption.size, color: tk.text.primary },
    actionDanger: { borderColor: tk.danger.DEFAULT, backgroundColor: tk.danger.light },
    actionDangerText: { color: tk.danger.DEFAULT },
    childRow: {
      marginTop: rnSpacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      marginLeft: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    childRowActive: { backgroundColor: tk.brandAccent.light },
    childTitle: { flex: 1, fontSize: rnType.label.size, color: tk.text.primary },
    childMeta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    /* 详情 */
    detailCard: {
      marginTop: rnSpacing.lg,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    detailTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    detailDesc: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    progress: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.secondary },
    statusRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
    },
    statusChip: {
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    statusChipActive: { borderColor: tk.brandAccent.deep, backgroundColor: tk.brandAccent.light },
    statusChipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    statusChipTextActive: { color: tk.text.primary, fontWeight: '600' },
    splitBtn: {
      marginTop: rnSpacing.md,
      minHeight: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    splitBtnText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    itemsLoading: { marginTop: rnSpacing.md },
    itemBlock: { marginTop: rnSpacing.xs },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
    },
    itemRowChild: { marginLeft: rnSpacing.lg },
    checkbox: {
      width: 18,
      height: 18,
      marginTop: 2,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSm: { width: 15, height: 15 },
    checkboxOn: { backgroundColor: tk.brand.DEFAULT, borderColor: tk.brandAccent.deep },
    checkMark: { fontSize: 11, lineHeight: 14, color: tk.brand.foreground },
    itemMain: { flex: 1 },
    itemText: { fontSize: rnType.body.size, color: tk.text.primary },
    itemTextSm: { fontSize: rnType.label.size, color: tk.text.primary },
    itemTextDone: { color: tk.text.tertiary, textDecorationLine: 'line-through' },
    itemMeta: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.tertiary },
    /* 弹层 */
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: tk.overlay.modal,
    },
    modalPanel: {
      backgroundColor: tk.surface.card,
      borderTopLeftRadius: rnRadiusFor.panel,
      borderTopRightRadius: rnRadiusFor.panel,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.lg,
      paddingBottom: rnSpacing.xl,
    },
    modalTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    modalList: { marginTop: rnSpacing.sm, maxHeight: 320 },
    modalItem: {
      paddingVertical: rnSpacing.md,
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.sm,
    },
    modalItemActive: { backgroundColor: tk.surface.muted },
    modalItemText: { fontSize: rnType.body.size, color: tk.text.primary },
    modalItemTextActive: { color: tk.text.primary, fontWeight: '600' },
    modalCancel: { marginTop: rnSpacing.md, paddingVertical: rnSpacing.md, alignItems: 'center' },
    modalCancelText: { fontSize: rnType.body.size, color: tk.text.secondary },
    formAvoid: { flex: 1, justifyContent: 'flex-end' },
    formPanel: {
      maxHeight: '88%',
      backgroundColor: tk.surface.card,
      borderTopLeftRadius: rnRadiusFor.panel,
      borderTopRightRadius: rnRadiusFor.panel,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.lg,
      paddingBottom: rnSpacing.xl,
    },
    input: {
      marginTop: rnSpacing.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    inputMultiline: { minHeight: 68, maxHeight: 140 },
    rowTwo: { flexDirection: 'row', gap: rnSpacing.sm },
    rowCell: { flex: 1 },
    formActions: { marginTop: rnSpacing.lg, flexDirection: 'row', gap: rnSpacing.sm },
    ghostBtn: {
      minHeight: 46,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnText: { fontSize: rnType.body.size, color: tk.text.secondary },
    submitBtn: {
      minHeight: 46,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
