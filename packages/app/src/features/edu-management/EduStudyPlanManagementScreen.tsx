// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { BookOpen, CheckCircle2, Circle, ListChecks } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'eduStudyPlanPage'

/** 与 web 同表(apps/web/app/(main)/edu/edu-management/study-plan/types.ts:71-90) */
const TYPE_KEY: Record<string, string> = {
  monthly: 'planTypeMonthly',
  weekly: 'planTypeWeekly',
}

const STATUS_KEY: Record<string, string> = {
  draft: 'statusDraft',
  active: 'statusActive',
  completed: 'statusCompleted',
  archived: 'statusArchived',
}

type BadgeTone = 'neutral' | 'info' | 'done'

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  active: 'info',
  completed: 'done',
  archived: 'neutral',
}

export interface EduTermView {
  id: string
  /** 已由薄壳按当前语言拼好「 (当前)」后缀 */
  nameText: string
  isCurrent: boolean
}

export interface EduClassView {
  id: string
  name: string
  /** 年级,空则不渲染 */
  grade: string | null
}

export interface EduStudyPlanRowView {
  id: string
  title: string
  description: string | null
  planType: string
  status: string
  /** 起止日期(薄壳按 locale 格式化后注入) */
  dateRangeText: string
}

export interface EduPlanItemView {
  id: string
  content: string
  /** 薄壳拼 objectivePrefix 后的行文本,空则不渲染 */
  objectiveText: string | null
  /** 薄壳拼 notesPrefix 后的行文本,空则不渲染 */
  notesText: string | null
  dueDateText: string | null
  completed: boolean
  /** 薄壳拼 completedAtPrefix 后的行文本,未完成则不渲染 */
  completedAtText: string | null
}

export interface EduPlanStatsView {
  overallRate: number
  totalItems: number
  totalCompleted: number
  rows: Array<{ planId: string; title: string; rate: number }>
}

export interface EduStudyPlanManagementScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(web 该页无登录门,RN 补门以免注定 401/403 的空请求) */
  loginRequiredText: string
  termsLoading: boolean
  termsError: string | null
  terms: EduTermView[]
  selectedTermId: string | null
  onSelectTerm: (id: string) => void
  classesLoading: boolean
  classesError: string | null
  classes: EduClassView[]
  selectedClassId: string | null
  onSelectClass: (id: string) => void
  plansLoading: boolean
  plansError: string | null
  plans: EduStudyPlanRowView[]
  selectedPlanId: string | null
  onSelectPlan: (id: string) => void
  detailLoading: boolean
  detailError: string | null
  planItems: EduPlanItemView[]
  statsLoading: boolean
  statsError: string | null
  stats: EduPlanStatsView | null
  onRefresh: () => void
}

/**
 * 学习计划管理共享屏 —— 承载 web /edu/edu-management/study-plan
 * (apps/web/app/(main)/edu/edu-management/study-plan/StudyPlanPage.tsx)。
 *
 * 首版承载主路径:学期选择 → 班级选择 → 计划列表 → 计划详情(条目)+ 完成率统计。
 * 省略的子面板如实登记在 manifest note:新建/编辑学期与班级弹窗(ClassDialog / TermDialog)、
 * 计划与条目编辑弹窗(StudyPlanEditDialog / PlanItemEditDialog)、月→周自动拆解
 * (POST /study-plan/:id/auto-split)、进度时间线弹窗(StudyPlanTimelineDialog / progress-timeline)。
 * 平台无关:取数、选中态、日期格式化、登录态全部由薄壳注入;本文件只管渲染与三态。
 */
export function EduStudyPlanManagementScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  termsLoading,
  termsError,
  terms,
  selectedTermId,
  onSelectTerm,
  classesLoading,
  classesError,
  classes,
  selectedClassId,
  onSelectClass,
  plansLoading,
  plansError,
  plans,
  selectedPlanId,
  onSelectPlan,
  detailLoading,
  detailError,
  planItems,
  statsLoading,
  statsError,
  stats,
  onRefresh,
}: EduStudyPlanManagementScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, badgeTone } = useMemo(() => createStyles(tk), [tk])
  const loggedIn = !loginRequiredText

  const labelOf = (status: string): string => t(`${NS}.${STATUS_KEY[status] ?? 'statusDraft'}`)
  const typeOf = (planType: string): string =>
    t(`${NS}.${TYPE_KEY[planType] ?? 'planTypeMonthly'}`)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <BookOpen size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.pageTitle`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.pageSubtitle`)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        {!loggedIn ? (
          <Text style={styles.gate}>{loginRequiredText}</Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{t(`${NS}.termLabel`)}</Text>
            {termsLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
              </View>
            ) : termsError ? (
              <Text style={styles.error}>{termsError}</Text>
            ) : terms.length === 0 ? (
              <Text style={styles.muted}>{t(`${NS}.noTerms`)}</Text>
            ) : (
              <View style={styles.chipRow}>
                {terms.map((term) => (
                  <TouchableOpacity
                    key={term.id}
                    style={[styles.chip, selectedTermId === term.id && styles.chipActive]}
                    onPress={() => onSelectTerm(term.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedTermId === term.id && styles.chipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {term.nameText}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.sectionLabel}>{t(`${NS}.classLabel`)}</Text>
            {classesLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
              </View>
            ) : classesError ? (
              <Text style={styles.error}>{classesError}</Text>
            ) : classes.length === 0 ? (
              <Text style={styles.muted}>{t(`${NS}.noClasses`)}</Text>
            ) : (
              <View style={styles.chipRow}>
                {classes.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, selectedClassId === item.id && styles.chipActive]}
                    onPress={() => onSelectClass(item.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedClassId === item.id && styles.chipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.grade ? `${item.name} · ${item.grade}` : item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>{t(`${NS}.completionStats`)}</Text>
            {statsLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
              </View>
            ) : statsError ? (
              <Text style={styles.error}>{statsError}</Text>
            ) : !stats ? (
              <Text style={styles.muted}>{t(`${NS}.noStatsData`)}</Text>
            ) : (
              <View style={styles.statsCard}>
                <Text style={styles.statsRate}>{`${t(`${NS}.overallRate`)} ${stats.overallRate}%`}</Text>
                <Text style={styles.muted}>
                  {t(`${NS}.completionProgress`, {
                    completed: stats.totalCompleted,
                    total: stats.totalItems,
                    rate: stats.overallRate,
                  })}
                </Text>
                <Text style={styles.muted}>
                  {`${t(`${NS}.totalItems`)}: ${stats.totalItems}`}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${stats.overallRate > 100 ? 100 : stats.overallRate < 0 ? 0 : stats.overallRate}%`,
                      },
                    ]}
                  />
                </View>
                {stats.rows.map((row) => (
                  <Text key={row.planId} style={styles.statsRow} numberOfLines={1}>
                    {`${row.title} · ${row.rate}%`}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>{t(`${NS}.planListTitle`)}</Text>
            {plansLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
              </View>
            ) : plansError ? (
              <Text style={styles.error}>{plansError}</Text>
            ) : plans.length === 0 ? (
              <View style={styles.centerBlock}>
                <ListChecks size={28} color={tk.text.tertiary} />
                <Text style={styles.muted}>{t(`${NS}.noStudyPlans`)}</Text>
              </View>
            ) : (
              plans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planCard, selectedPlanId === plan.id && styles.planCardActive]}
                  onPress={() => onSelectPlan(plan.id)}
                >
                  <View style={styles.planHead}>
                    <Text style={styles.planTitle} numberOfLines={2}>
                      {plan.title}
                    </Text>
                    <Text
                      style={[
                        styles.badge,
                        badgeTone[STATUS_TONE[plan.status] ?? 'neutral'],
                      ]}
                    >
                      {labelOf(plan.status)}
                    </Text>
                  </View>
                  {plan.description ? (
                    <Text style={styles.cardBody} numberOfLines={2}>
                      {plan.description}
                    </Text>
                  ) : null}
                  <View style={styles.planMetaRow}>
                    <Text style={styles.cardMeta}>{typeOf(plan.planType)}</Text>
                    <Text style={styles.cardMeta}>{plan.dateRangeText}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.sectionTitle}>{t(`${NS}.planItems`)}</Text>
            {!selectedPlanId ? (
              <Text style={styles.muted}>{t(`${NS}.selectPlanHint`)}</Text>
            ) : detailLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
              </View>
            ) : detailError ? (
              <Text style={styles.error}>{detailError}</Text>
            ) : planItems.length === 0 ? (
              <View style={styles.centerBlock}>
                <BookOpen size={28} color={tk.text.tertiary} />
                <Text style={styles.muted}>{t(`${NS}.noPlanItems`)}</Text>
              </View>
            ) : (
              planItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHead}>
                    {item.completed ? (
                      <CheckCircle2 size={16} color={tk.success.deepText} />
                    ) : (
                      <Circle size={16} color={tk.text.tertiary} />
                    )}
                    <Text
                      style={[styles.itemContent, item.completed && styles.itemContentDone]}
                    >
                      {item.content}
                    </Text>
                  </View>
                  {item.objectiveText ? (
                    <Text style={styles.cardMeta}>{item.objectiveText}</Text>
                  ) : null}
                  {item.notesText ? <Text style={styles.cardMeta}>{item.notesText}</Text> : null}
                  {item.dueDateText ? (
                    <Text style={styles.cardMeta}>
                      {`${t(`${NS}.dueDate`)}: ${item.dueDateText}`}
                    </Text>
                  ) : null}
                  {item.completedAtText ? (
                    <Text style={styles.cardMeta}>{item.completedAtText}</Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { paddingBottom: rnSpacing['2xl'] },
    gate: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    sectionLabel: {
      marginTop: rnSpacing.md,
      marginBottom: rnSpacing.xs,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    sectionTitle: {
      marginTop: rnSpacing.lg,
      marginBottom: rnSpacing.sm,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      maxWidth: '100%',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xl,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    statsCard: {
      gap: rnSpacing.xs,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    statsRate: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    progressTrack: {
      height: 6,
      marginVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    progressBar: { height: 6, borderRadius: rnRadius.sm, backgroundColor: tk.brand.DEFAULT },
    statsRow: { fontSize: rnType.caption.size, color: tk.text.secondary },
    planCard: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    planCardActive: { borderColor: tk.brand.DEFAULT },
    planHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    planTitle: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    planMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
    },
    cardBody: { fontSize: rnType.label.size, color: tk.text.secondary },
    cardMeta: { fontSize: rnType.caption.size, color: tk.text.secondary },
    itemCard: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    itemContent: {
      flex: 1,
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    itemContentDone: { color: tk.text.secondary, textDecorationLine: 'line-through' },
  })

  const badgeTone: Record<BadgeTone, { backgroundColor: string; color: string }> = {
    neutral: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    info: { backgroundColor: tk.surface.card, color: tk.brand.DEFAULT },
    done: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
  }

  return { styles, badgeTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
