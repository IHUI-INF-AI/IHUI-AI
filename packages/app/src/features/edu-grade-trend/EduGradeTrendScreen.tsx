// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { AlertTriangle, BookOpen, TrendingUp } from 'lucide-react-native'
import {
  CHART_AMBER,
  CHART_CYAN,
  CHART_GREEN,
  CHART_ORANGE,
  CHART_PINK,
  CHART_RED,
  CHART_VIOLET,
  rnRadius,
  rnRadiusFor,
  rnSpacing,
  rnType,
} from '@ihui/design-tokens'
import type {
  EduGradeTrendEntry,
  EduGradeTrendScreenProps,
  EduGradeWeaknessItem,
} from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type { EduGradeTrendEntry, EduGradeTrendScreenProps, EduGradeWeaknessItem }

/** 得分率百分比:脏满分(0 / 负数 / NaN)一律按 0,不参与除法 */
function rateOf(score: number, totalScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(totalScore) || totalScore <= 0) return 0
  return clampPercent((score / totalScore) * 100)
}

/** 夹到 0..100;条宽 `${n}%` 越界在 RN 上会被裁掉,不夹反而看不出来 */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** 分数字面量:整数原样,小数保留 1 位(后端 score 是 numeric,可能回 87.5) */
function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** 日期:后端是 date 列(可能是 ISO 串) ⇒ 统一裁到 `YYYY-MM-DD`,同 web 的日期列 */
function formatDate(value?: string | null): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

/** 一次考试的纵向分组:同一 examName 的多个科目并成一屏一段 */
interface ExamGroup {
  examName: string
  examDate: string
  rows: EduGradeTrendEntry[]
}

/**
 * EduGradeTrendScreen 成绩趋势 / 薄弱环节屏(共享层)
 *
 * 2026-10-28 补屏立,承载 web `edu/edu-management/grades/trend/[studentId]`
 * (apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/PageClient.tsx):
 * - 结构:顶栏(返回 / 标题)→ 副标题 → 科目筛选 + 成绩趋势(按考试分组的得分率条)
 *   → 科目成绩分布(得分率条)→ 薄弱环节(科目 + 薄弱徽章 + 平均分/得分率/考试次数)
 * - 图表:RN 无 recharts,**不引图表库**。折线图 → 按考试分组的横向色条(每科一条,
 *   条长 = 该科该次考试的得分率,颜色按科目从 token 调色板取);雷达图 → 逐科得分率条。
 *   两处都在「同一维度可比较」的前提下等义:web 折线读的是跨考试的走向,RN 分组条读的是
 *   同一次考试内各科的相对高低,先分组再按 examDate 升序排列,走向仍可逐段读出。
 * - 平台无关:两条 GET、筛选重取、导航全由 wrapper 注入;颜色走 getTokens(colorScheme),
 *   零 hex(科目色取自 @ihui/design-tokens 的图表色唯一真源,与 web SUBJECT_COLORS 同序)
 * - i18n:`eduGradeTrend.*`(新增)+ 复用 common.back / common.retry
 */
export function EduGradeTrendScreen({
  t,
  studentId,
  entries,
  weaknesses,
  selectedSubject,
  loading,
  error,
  onBack,
  onRetry,
  onSelectSubject,
  colorScheme = 'light',
}: EduGradeTrendScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /* 科目清单口径同 web:从 trend 点里排序去重(筛选后只剩一科也是真实现状,不另编) */
  const subjects = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.subject))).sort(),
    [entries],
  )

  /* web 的 examNames 横轴 → RN 的分组段:保持首次出现顺序(后端按 examDate 升序回) */
  const groups = useMemo(() => {
    const map = new Map<string, ExamGroup>()
    for (const entry of entries) {
      const group = map.get(entry.examName) ?? {
        examName: entry.examName,
        examDate: entry.examDate,
        rows: [],
      }
      group.rows.push(entry)
      map.set(entry.examName, group)
    }
    return [...map.values()]
  }, [entries])

  /* 与 web SUBJECT_COLORS 同序:--primary 打头,再接 chart-2..chart-8 */
  const palette = [
    tk.brand.DEFAULT,
    CHART_GREEN,
    CHART_AMBER,
    CHART_RED,
    CHART_VIOLET,
    CHART_PINK,
    CHART_CYAN,
    CHART_ORANGE,
  ]
  const colorOf = (subject: string): string => {
    const index = subjects.indexOf(subject)
    return palette[(index < 0 ? 0 : index) % palette.length] ?? tk.brand.DEFAULT
  }

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('eduGradeTrend.title')}</Text>
      {/* 右侧占位:与左侧返回键等宽,标题才是真居中而不是被按钮挤偏 */}
      <View style={styles.headerSpacer} />
    </View>
  )

  if (loading && entries.length === 0 && weaknesses.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && entries.length === 0 && weaknesses.length === 0) {
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

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          {t('eduGradeTrend.subtitle', { studentId: studentId.slice(0, 8) })}
        </Text>

        {/* 科目筛选:web 是 Select,RN 用横滑胶囊,值域与语义一致(空串 = 全部) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.chip, selectedSubject === '' ? styles.chipActive : null]}
            onPress={() => onSelectSubject('')}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedSubject === '' }}
          >
            <Text style={selectedSubject === '' ? styles.chipTextActive : styles.chipTextInactive}>
              {t('eduGradeTrend.allSubjects')}
            </Text>
          </TouchableOpacity>
          {subjects.map((subject) => (
            <TouchableOpacity
              key={subject}
              style={[styles.chip, subject === selectedSubject ? styles.chipActive : null]}
              onPress={() => onSelectSubject(subject)}
              accessibilityRole="button"
              accessibilityState={{ selected: subject === selectedSubject }}
            >
              <Text
                style={
                  subject === selectedSubject ? styles.chipTextActive : styles.chipTextInactive
                }
              >
                {subject}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 成绩趋势(web 折线图) */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <TrendingUp size={14} color={tk.text.secondary} strokeWidth={2} />
            <Text style={styles.cardTitle}>{t('eduGradeTrend.scoreTrend')}</Text>
          </View>
          {groups.length === 0 ? (
            <EmptyState title={t('eduGradeTrend.emptyScores')} colorScheme={colorScheme} />
          ) : (
            groups.map((group) => (
              <View key={group.examName} style={styles.examBlock}>
                <View style={styles.examHead}>
                  <Text style={styles.examName} numberOfLines={1}>
                    {group.examName}
                  </Text>
                  <Text style={styles.examDate}>{formatDate(group.examDate)}</Text>
                </View>
                {group.rows.map((row) => (
                  <View
                    key={row.id || `${row.examName}-${row.subject}`}
                    style={styles.barRow}
                    accessibilityRole="text"
                    accessibilityLabel={`${row.subject} ${formatScore(row.score)}/${formatScore(
                      row.totalScore,
                    )}`}
                  >
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {row.subject}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${rateOf(row.score, row.totalScore)}%`,
                            backgroundColor: colorOf(row.subject),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>
                      {`${formatScore(row.score)}/${formatScore(row.totalScore)}`}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        {/* 科目成绩分布(web 雷达图) */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <BookOpen size={14} color={tk.text.secondary} strokeWidth={2} />
            <Text style={styles.cardTitle}>{t('eduGradeTrend.subjectScoreDistribution')}</Text>
          </View>
          {weaknesses.length === 0 ? (
            <EmptyState title={t('eduGradeTrend.emptySubjects')} colorScheme={colorScheme} />
          ) : (
            weaknesses.map((item) => (
              <View key={item.subject} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.subject}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${clampPercent(item.percentage)}%`,
                        backgroundColor: colorOf(item.subject),
                      },
                    ]}
                  />
                </View>
                <Text
                  style={styles.barValue}
                >{`${Math.round(clampPercent(item.percentage))}%`}</Text>
              </View>
            ))
          )}
        </View>

        {/* 薄弱环节(web 列表) */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <AlertTriangle size={14} color={tk.text.secondary} strokeWidth={2} />
            <Text style={styles.cardTitle}>{t('eduGradeTrend.weaknesses')}</Text>
          </View>
          {weaknesses.length === 0 ? (
            <EmptyState title={t('eduGradeTrend.emptyData')} colorScheme={colorScheme} />
          ) : (
            weaknesses.map((item) => (
              <View key={item.subject} style={styles.weakRow}>
                <View style={styles.weakHead}>
                  <Text style={styles.weakSubject} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  {item.isWeak ? (
                    <View style={styles.weakBadge}>
                      <Text style={styles.weakBadgeText}>{t('eduGradeTrend.weakBadge')}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.weakStats}>
                  <Text style={styles.weakStat}>
                    {t('eduGradeTrend.avgScoreStat', { score: formatScore(item.avgScore) })}
                  </Text>
                  <Text style={styles.weakStat}>
                    {t('eduGradeTrend.scoreRateStat', {
                      percentage: Math.round(clampPercent(item.percentage)),
                    })}
                  </Text>
                  <Text style={styles.weakStat}>
                    {t('eduGradeTrend.examCountStat', { count: item.examCount })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      fontSize: rnType.title.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    scroll: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    subtitle: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    /* 科目筛选胶囊 */
    filterRow: {
      marginTop: rnSpacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingRight: rnSpacing.lg,
    },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    /* 选中态走反色实底(brand.cta 明暗自动翻面),与登录页分段控件同档 */
    chipActive: {
      borderColor: tk.brand.cta,
      backgroundColor: tk.brand.cta,
    },
    chipTextInactive: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    chipTextActive: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    /* 卡片 */
    card: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    cardTitle: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    /* 趋势分组 */
    examBlock: {
      gap: rnSpacing.xs,
    },
    examHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    examName: {
      flexShrink: 1,
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    examDate: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    /* 得分率条:标签定宽 + 轨道占满 + 读数右对齐,三列对齐不靠猜 */
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    barLabel: {
      width: 56,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    barTrack: {
      flex: 1,
      height: 6,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    barFill: {
      height: 6,
      borderRadius: rnRadius.xl,
    },
    barValue: {
      width: 56,
      fontSize: rnType.caption.size,
      textAlign: 'right',
      color: tk.text.primary,
    },
    /* 薄弱环节行 */
    weakRow: {
      /* 行间分隔靠间距,不用单边描边(AGENTS §4 禁分割线) */
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.xs,
    },
    weakHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    weakSubject: {
      flexShrink: 1,
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    weakBadge: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.danger.light,
    },
    weakBadgeText: {
      fontSize: rnType.caption.size,
      color: tk.danger.DEFAULT,
    },
    weakStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.md,
    },
    weakStat: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
