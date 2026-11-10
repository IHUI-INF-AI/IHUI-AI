// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 成绩单的可复用段 —— 四格统计 / 全量解析 / 底部三操作。
 *
 * 单源约定:
 * - web(`apps/web/app/(main)/exam/[id]/result/PageClient.tsx`)与 mobile-rn 都从本文件消费;
 * - 三操作只接收注入回调,段内不触碰任何平台 API(小程序 share 的 openType 由宿主壳承担);
 * - `normalizeExamAnswer` 是跨端答案口径唯一实现(数组答案以 "、" 连接,空答案回落空串)。
 */
import { useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamResultItem, ExamResultReviewItem, TFunction } from '../../types'

/** 跨端答案文本口径 —— web/mobile-rn 共用,禁止在任一端另写一份 */
export function normalizeExamAnswer(value?: string | string[] | null): string {
  if (Array.isArray(value)) return value.join('、')
  return (value ?? '').trim()
}

/** 四格统计的口径与顺序(正确 / 答错 / 未答 / 用时) */
export interface ExamResultStatsValue {
  correct: number
  wrong: number
  unanswered: number
  duration: number
}

export function deriveExamResultStats(item: ExamResultItem): ExamResultStatsValue {
  const correct = item.correctCount ?? 0
  const wrong =
    item.wrongCount ?? Math.max(0, item.totalCount - correct - (item.unansweredCount ?? 0))
  const unanswered = item.unansweredCount ?? 0
  return { correct, wrong, unanswered, duration: item.duration ?? 0 }
}

export interface ExamResultStatsProps {
  item: ExamResultItem
  t: TFunction
  colorScheme?: 'light' | 'dark'
}

/** 四格统计 —— web 端「错/未答/正确 三数」与 RN 同源 */
export function ExamResultStats({ item, t, colorScheme = 'light' }: ExamResultStatsProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const stats = deriveExamResultStats(item)
  const cells = [
    { key: 'correct', label: t('examResult.statCorrect'), value: stats.correct },
    { key: 'wrong', label: t('examResult.statWrong'), value: stats.wrong },
    { key: 'unanswered', label: t('examResult.statUnanswered'), value: stats.unanswered },
    { key: 'duration', label: t('examResult.duration'), value: stats.duration },
  ]

  return (
    <View style={styles.statsGrid}>
      {cells.map((cell) => (
        <View key={cell.key} style={styles.statsCell}>
          <Text style={styles.statsValue}>
            {cell.key === 'duration'
              ? t('examResult.durationUnit', { n: cell.value })
              : t('examResult.countUnit', { n: cell.value })}
          </Text>
          <Text style={styles.statsLabel}>{cell.label}</Text>
        </View>
      ))}
    </View>
  )
}

export interface ExamResultReviewListProps {
  reviews: ExamResultReviewItem[]
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 全量解析真源才有得分;仅错题回落时隐藏得分,避免展示 0 分误导 */
  showScore?: boolean
}

/** 全量解析(题干 + 你的答案 + 正确答案 + 解析 + 本题得分),不再只有错题 */
export function ExamResultReviewList({
  reviews,
  t,
  colorScheme = 'light',
  showScore = true,
}: ExamResultReviewListProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View>
      <Text style={styles.sectionTitle}>{t('examResult.reviewTitle')}</Text>
      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>{t('examResult.noReview')}</Text>
      ) : (
        reviews.map((review, index) => {
          const yourAnswer = normalizeExamAnswer(review.yourAnswer)
          const correctAnswer = normalizeExamAnswer(review.correctAnswer)
          return (
            <View key={review.id || String(index)} style={styles.card}>
              <View style={styles.reviewHeader}>
                <Text style={styles.question}>
                  {t('examResult.questionIdx', { n: index + 1 })}. {review.title}
                </Text>
                <Text style={review.isCorrect ? styles.reviewRight : styles.reviewWrong}>
                  {review.isCorrect ? t('examResult.reviewCorrect') : t('examResult.reviewWrong')}
                </Text>
              </View>
              <Text style={styles.yourAnswer}>
                {t('examResult.yourAnswer')}
                {yourAnswer || t('examResult.unansweredAnswer')}
              </Text>
              {!review.isCorrect ? (
                <Text style={styles.correctAnswer}>
                  {t('examResult.correctAnswer')}
                  {correctAnswer}
                </Text>
              ) : null}
              {review.analysis ? (
                <View style={styles.analysisBox}>
                  <Text style={styles.analysisLabel}>{t('examResult.analysis')}</Text>
                  <Text style={styles.analysisText}>{review.analysis}</Text>
                </View>
              ) : null}
              {showScore ? (
                <Text style={styles.reviewScore}>
                  {t('examResult.reviewScore', { n: review.score })}
                </Text>
              ) : null}
            </View>
          )
        })
      )}
    </View>
  )
}

export interface ExamResultActionsProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 三个回调都由宿主注入;为空的按钮不渲染 */
  onRetryExam?: () => void
  onViewList?: () => void
  onShare?: () => void
  /** 宿主自带的分享控件(小程序 openType=share 只能由壳提供);给了就替换掉内建分享按钮 */
  shareAction?: ReactNode
}

/** 底部三操作 —— 再考一次 / 查看列表 / 分享(分享的平台能力由注入回调承担) */
export function ExamResultActions({
  t,
  colorScheme = 'light',
  onRetryExam,
  onViewList,
  onShare,
  shareAction,
}: ExamResultActionsProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const actions = [
    { key: 'retry', label: t('examResult.retry'), onPress: onRetryExam, primary: true },
    { key: 'list', label: t('examResult.viewList'), onPress: onViewList, primary: false },
  ].filter((action) => !!action.onPress)

  const shareSlot =
    shareAction ??
    (onShare ? (
      <Pressable
        key="share"
        accessibilityRole="button"
        onPress={onShare}
        style={[styles.actionButton, styles.actionGhost]}
      >
        <Text style={styles.actionGhostText}>{t('examResult.share')}</Text>
      </Pressable>
    ) : null)

  if (actions.length === 0 && !shareSlot) return null

  return (
    <View style={styles.actionsRow}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          onPress={action.onPress}
          style={[styles.actionButton, action.primary ? styles.actionPrimary : styles.actionGhost]}
        >
          <Text style={action.primary ? styles.actionPrimaryText : styles.actionGhostText}>
            {action.label}
          </Text>
        </Pressable>
      ))}
      {shareSlot}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.md,
    },
    statsCell: {
      flexGrow: 1,
      flexBasis: '22%',
      minWidth: 72,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
    },
    statsValue: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    statsLabel: { marginTop: rnSpacing.xs, fontSize: rnType.caption.size, color: tk.text.tertiary },
    sectionTitle: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    emptyText: { fontSize: rnType.body.size, color: tk.text.tertiary, marginBottom: rnSpacing.md },
    card: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.sm,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: rnSpacing.sm },
    question: { flex: 1, fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    reviewRight: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    reviewWrong: { fontSize: rnType.caption.size, color: tk.danger.DEFAULT },
    yourAnswer: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    correctAnswer: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.body.size,
      color: tk.brand.DEFAULT,
    },
    analysisBox: {
      marginTop: rnSpacing.sm,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    analysisLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    analysisText: { marginTop: rnSpacing.xs, fontSize: rnType.body.size, color: tk.text.primary },
    reviewScore: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
    },
    actionButton: {
      flexGrow: 1,
      minWidth: 96,
      alignItems: 'center',
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
    },
    actionPrimary: {
      backgroundColor: tk.brand.DEFAULT,
      borderColor: tk.brand.DEFAULT,
    },
    actionGhost: {
      backgroundColor: tk.surface.light,
      borderColor: tk.border.light,
    },
    actionPrimaryText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.surface.bg },
    actionGhostText: { fontSize: rnType.body.size, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
