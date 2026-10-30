// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
} from 'react-native'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Users,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'eduHomework'

/** 与 web SUBMISSION_STATUS 同值集(apps/web/app/(main)/edu/edu-management/homework/PageClient.tsx:90-95) */
export const HOMEWORK_STATUSES = ['submitted', 'graded', 'late', 'resubmit'] as const

/** 状态码 → 本 ns 取词键(web SUBMISSION_STATUS.labelKey 同表,PageClient.tsx:91-94) */
export const HOMEWORK_STATUS_LABEL_KEYS: Record<string, string> = {
  submitted: 'statusSubmitted',
  graded: 'statusGraded',
  late: 'statusLate',
  resubmit: 'statusResubmit',
}

type StatusTone = 'submitted' | 'graded' | 'late' | 'resubmit' | 'neutral'

/** 与 web SUBMISSION_STATUS.color 同档(bg-blue/green/orange/purple → 令牌同名色系) */
const STATUS_TONE: Record<string, StatusTone> = {
  submitted: 'submitted',
  graded: 'graded',
  late: 'late',
  resubmit: 'resubmit',
}

export interface HomeworkTermOption {
  id: string
  /** 已拼好当前学期后缀(web `{name}{currentTermTag}`,PageClient.tsx:336-337) */
  label: string
}

export interface HomeworkClassOption {
  id: string
  /** web `{name} ({grade})`,PageClient.tsx:357-359 */
  label: string
}

/** 统计四卡;值由薄壳格式化(平均分走 scoreWithUnit 带单位,PageClient.tsx:291) */
export interface HomeworkStatsView {
  totalText: string
  gradedText: string
  avgText: string
  rateText: string
}

export interface HomeworkSubmissionView {
  id: string
  studentText: string
  contentText: string
  submittedAtText: string
  status: string
  statusText: string
  /** 已格式化分数;未批改落 '-' */
  scoreText: string
  scorePass: boolean
  commentText: string
  /** web: status !== 'graded' 才给「批改」按钮(PageClient.tsx:505) */
  gradable: boolean
}

export interface EduHomeworkScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(web 该页无 AuthGate,但端点要求登录+edu 权限;未登录不发注定 401 的请求) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  onRetry: () => void
  terms: HomeworkTermOption[]
  selectedTermId: string
  onSelectTerm: (id: string) => void
  classes: HomeworkClassOption[]
  selectedClassId: string
  onSelectClass: (id: string) => void
  stats: HomeworkStatsView | null
  statsLoading: boolean
  submissions: HomeworkSubmissionView[]
  statusFilter: string
  onStatusFilter: (value: string) => void
  loadingSubmissions: boolean
  gradeSaving: boolean
  gradeError: string | null
  /** 返回 true 表示批改成功,屏内自行关弹窗 */
  onSubmitGrade: (id: string, score: number, comment: string) => Promise<boolean>
}

/**
 * 作业管理共享屏 —— 承载 web /edu/edu-management/homework。
 *
 * 同源同参的后端面(证据见 endpoints/edu-management-homework.ts 头注):
 * term → class → homework-submission/stats + homework-submission,批改 PUT :id/grade。
 * 与 web 的口径差(如实登记):
 *  - web 顶栏是俩 shadcn Select 下拉,RN 落为可横滑 chip 行(同两维筛选、同默认值:当前学期 + 首班)。
 *  - web 统计四卡读 totalSubmissions / averageScore,后端实际返回 totalCount / avgScore
 *    (edu-ai-management.ts:3802),线上四卡恒 '-' —— RN 按后端真字段取值,不回抄错位。
 *  - web 表格的「学生姓名」列读 s.studentName,但 edu_homework_submission 表无该列
 *    (schema/edu-ai-management.ts:523-548 只有 studentId),线上该列恒空白 ——
 *    RN 薄壳以 studentId 前 8 位兜底,不伪造姓名。
 *  - web 七列表格 + 批改弹窗,RN 落为「卡片行 + 底部批改弹层」,列文案仍逐字取同一批键。
 * 平台无关:取数 / 文案取词 / 时间格式化 / 登录权限错误透出由薄壳注入,本文件只管渲染三态。
 */
export function EduHomeworkScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  onRetry,
  terms,
  selectedTermId,
  onSelectTerm,
  classes,
  selectedClassId,
  onSelectClass,
  stats,
  statsLoading,
  submissions,
  statusFilter,
  onStatusFilter,
  loadingSubmissions,
  gradeSaving,
  gradeError,
  onSubmitGrade,
}: EduHomeworkScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, badgeTone } = useMemo(() => createStyles(tk), [tk])

  const [gradingId, setGradingId] = useState<string | null>(null)
  const [scoreInput, setScoreInput] = useState('')
  const [commentInput, setCommentInput] = useState('')

  const grading = gradingId ? submissions.find((s) => s.id === gradingId) ?? null : null

  const openGrade = (row: HomeworkSubmissionView) => {
    setGradingId(row.id)
    setScoreInput(row.scoreText === '-' ? '' : row.scoreText)
    setCommentInput(row.commentText === '-' ? '' : row.commentText)
  }

  const closeGrade = () => {
    setGradingId(null)
    setScoreInput('')
    setCommentInput('')
  }

  const submitGrade = async () => {
    if (!gradingId) return
    const parsed = Number(scoreInput)
    const score = Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0
    const ok = await onSubmitGrade(gradingId, score, commentInput.trim())
    if (ok) closeGrade()
  }

  const statCards = [
    { key: 'total', label: t(`${NS}.statsTotalSubmissions`), value: stats?.totalText ?? '-', icon: FileText },
    { key: 'graded', label: t(`${NS}.statsGradedCount`), value: stats?.gradedText ?? '-', icon: CheckCircle2 },
    { key: 'avg', label: t(`${NS}.statsAvgScore`), value: stats?.avgText ?? '-', icon: BarChart3 },
    {
      key: 'rate',
      label: t(`${NS}.statsCompletionRate`),
      value: stats?.rateText ?? '-',
      icon: Users,
    },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <Text style={styles.title}>{t(`${NS}.pageTitle`)}</Text>
          <Text style={styles.subtitle}>{t(`${NS}.pageSubtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBlock}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={onRetry}>
            <Text style={styles.outlineBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.pickerBlock}>
            <Text style={styles.pickerLabel}>{t(`${NS}.selectTerm`)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {terms.map((term) => {
                  const active = term.id === selectedTermId
                  return (
                    <TouchableOpacity
                      key={term.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => onSelectTerm(term.id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {term.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.pickerBlock}>
            <Text style={styles.pickerLabel}>{t(`${NS}.selectClass`)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {classes.map((cls) => {
                  const active = cls.id === selectedClassId
                  return (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => onSelectClass(cls.id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {cls.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>
          </View>

          {selectedClassId ? (
            <View style={styles.statsGrid}>
              {statCards.map((card) => {
                const Icon = card.icon
                return (
                  <View key={card.key} style={styles.statCard}>
                    <View style={styles.statHead}>
                      <Icon size={14} color={tk.text.secondary} />
                      <Text style={styles.statLabel}>{card.label}</Text>
                    </View>
                    {statsLoading ? (
                      <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                    ) : (
                      <Text style={styles.statValue}>{card.value}</Text>
                    )}
                  </View>
                )
              })}
            </View>
          ) : null}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t(`${NS}.submissionsTitle`)}</Text>
            {loadingSubmissions ? (
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, statusFilter === 'all' && styles.chipActive]}
                onPress={() => onStatusFilter('all')}
              >
                <Text style={[styles.chipText, statusFilter === 'all' && styles.chipTextActive]}>
                  {t(`${NS}.allStatus`)}
                </Text>
              </TouchableOpacity>
              {HOMEWORK_STATUSES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, statusFilter === value && styles.chipActive]}
                  onPress={() => onStatusFilter(value)}
                >
                  <Text style={[styles.chipText, statusFilter === value && styles.chipTextActive]}>
                    {t(`${NS}.${HOMEWORK_STATUS_LABEL_KEYS[value]}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {!selectedClassId ? (
            <View style={styles.centerBlock}>
              <AlertCircle size={28} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t(`${NS}.selectClassFirst`)}</Text>
            </View>
          ) : loadingSubmissions ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={styles.muted}>{t(`${NS}.loadingSubmissions`)}</Text>
            </View>
          ) : submissions.length === 0 ? (
            <View style={styles.centerBlock}>
              <FileText size={28} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t(`${NS}.emptySubmissions`)}</Text>
            </View>
          ) : (
            submissions.map((row) => (
              <View key={row.id} style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowStudent}>{row.studentText}</Text>
                  <Text style={[styles.badge, badgeTone[STATUS_TONE[row.status] ?? 'neutral']]}>
                    {row.statusText}
                  </Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.thContent`)}</Text>
                  <Text style={styles.fieldValue} numberOfLines={2}>
                    {row.contentText}
                  </Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.thSubmittedAt`)}</Text>
                  <View style={styles.inlineMeta}>
                    <Clock size={12} color={tk.text.tertiary} />
                    <Text style={styles.fieldValue}>{row.submittedAtText}</Text>
                  </View>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.score`)}</Text>
                  <Text
                    style={[styles.fieldValue, row.scorePass ? styles.scorePass : styles.scoreFail]}
                  >
                    {row.scoreText}
                  </Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.comment`)}</Text>
                  <Text style={styles.fieldValue} numberOfLines={2}>
                    {row.commentText}
                  </Text>
                </View>
                {row.gradable ? (
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => openGrade(row)}>
                    <CheckCircle2 size={12} color={tk.text.primary} />
                    <Text style={styles.outlineBtnText}>{t(`${NS}.grade`)}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={grading !== null}
        transparent
        animationType="slide"
        onRequestClose={closeGrade}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(`${NS}.gradeDialogTitle`)}</Text>
            {grading ? (
              <View style={styles.modalBody}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLine}>
                    <Text style={styles.infoLabel}>{t(`${NS}.studentLabel`)}</Text>
                    {grading.studentText}
                  </Text>
                  <Text style={styles.infoLine}>
                    <Text style={styles.infoLabel}>{t(`${NS}.contentLabel`)}</Text>
                    {grading.contentText}
                  </Text>
                  <Text style={styles.infoLine}>
                    <Text style={styles.infoLabel}>{t(`${NS}.submittedAtLabel`)}</Text>
                    {grading.submittedAtText}
                  </Text>
                </View>
                <Text style={styles.pickerLabel}>{t(`${NS}.score`)}</Text>
                <TextInput
                  style={styles.input}
                  value={scoreInput}
                  onChangeText={setScoreInput}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholderTextColor={tk.text.tertiary}
                />
                <Text style={styles.pickerLabel}>{t(`${NS}.comment`)}</Text>
                <TextInput
                  style={styles.input}
                  value={commentInput}
                  onChangeText={setCommentInput}
                  placeholder={t(`${NS}.commentPlaceholder`)}
                  placeholderTextColor={tk.text.tertiary}
                />
                {gradeError ? <Text style={styles.error}>{gradeError}</Text> : null}
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={closeGrade}>
                <Text style={styles.outlineBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, gradeSaving && styles.primaryBtnDisabled]}
                onPress={() => void submitGrade()}
                disabled={gradeSaving}
              >
                {gradeSaving ? <ActivityIndicator size="small" color={tk.surface.light} /> : null}
                <Text style={styles.primaryBtnText}>{t(`${NS}.submitGrade`)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    error: { fontSize: rnType.caption.size, color: tk.danger.DEFAULT },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { paddingBottom: rnSpacing['2xl'], gap: rnSpacing.sm },
    pickerBlock: { gap: rnSpacing.xs },
    pickerLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    chipRow: { flexDirection: 'row', gap: rnSpacing.sm, paddingVertical: 2 },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    statCard: {
      flexGrow: 1,
      flexBasis: '46%',
      gap: rnSpacing.xs,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    statHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    statLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    statValue: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    sectionTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    row: {
      gap: rnSpacing.xs,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    rowStudent: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
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
    inlineMeta: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: rnSpacing.xs,
    },
    scorePass: { fontSize: rnType.label.size, fontWeight: '600', color: tk.success.deepText },
    scoreFail: { fontSize: rnType.label.size, fontWeight: '600', color: tk.danger.DEFAULT },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    outlineBtnText: { fontSize: rnType.caption.size, color: tk.text.primary },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: tk.overlay.modal,
    },
    modalCard: {
      gap: rnSpacing.sm,
      padding: rnSpacing.lg,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    modalTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    modalBody: { gap: rnSpacing.xs },
    infoBox: {
      gap: rnSpacing.xs,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    infoLine: { fontSize: rnType.caption.size, color: tk.text.primary },
    infoLabel: { color: tk.text.secondary },
    input: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    modalActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
  })

  const badgeTone: Record<StatusTone, TextStyle> = {
    submitted: { backgroundColor: tk.brandAccent.light, color: tk.brandAccent.deep },
    graded: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    late: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
    resubmit: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    neutral: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
  }

  return { styles, badgeTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
