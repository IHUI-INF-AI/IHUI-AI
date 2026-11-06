// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, Text, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamResultItem, ExamResultReviewItem, ExamResultScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { usePublishShareIntent } from '@ihui/shared/share'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { assertRequiredPort } from '../../host/ports'
import { ExamResultActions, ExamResultReviewList, ExamResultStats } from './exam-result-sections'

/** ExamResult 共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { ExamResultItem, ExamResultScreenProps }

export function ExamResultScreen({
  t,
  item,
  loading,
  error,
  onBack,
  onRetry,
  colorScheme = 'light',
  onNavigate,
  onRetryExam,
  onViewList,
  onShare,
}: ExamResultScreenProps & { onRetry?: () => void }) {
  assertRequiredPort('onNavigate', onNavigate)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 分享正文交给宿主。path 是**列表页**而非本页 ⇒ 必须显式发布,交宿主兜底会把落点改成成绩页自己。
  usePublishShareIntent({
    title: item ? t('examResult.shareTitle', { n: item.score }) : t('share.appTitle'),
    path: '/pages/exam/list',
  })

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }
  if (error || !item) {
    return (
      <ErrorState
        message={error || t('examResult.loadFailed')}
        onRetry={onRetry}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  const hasDetails = Array.isArray(item.details) && item.details.length > 0
  const reviews: ExamResultReviewItem[] = hasDetails
    ? item.details!
    : (item.wrongQuestions ?? []).map((q, index) => ({
        id: String(q.index ?? index),
        title: q.question,
        yourAnswer: q.yourAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: false,
        score: 0,
      }))

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      {item.examTitle ? <Text style={styles.title}>{item.examTitle}</Text> : null}
      <View
        style={[styles.scoreCard, item.passed ? styles.scoreCardPassed : styles.scoreCardFailed]}
      >
        <Text style={styles.scoreText}>
          {item.score}/{item.totalScore}
        </Text>
        <Text style={item.passed ? styles.passedText : styles.failedText}>
          {item.passed ? t('examResult.passed') : t('examResult.failed')}
        </Text>
        {typeof item.rank === 'number' ? (
          <Text style={styles.rankText}>
            {t('examResult.rank', { rank: item.rank, total: item.rankTotal ?? 0 })}
          </Text>
        ) : null}
      </View>
      <ExamResultStats item={item} t={t} colorScheme={colorScheme} />
      {item.submittedAt ? <Text style={styles.submittedAt}>{item.submittedAt}</Text> : null}
      <ExamResultReviewList
        reviews={reviews}
        t={t}
        colorScheme={colorScheme}
        showScore={hasDetails}
      />
      <ExamResultActions
        t={t}
        colorScheme={colorScheme}
        onRetryExam={onRetryExam}
        onViewList={onViewList}
        onShare={onShare}
      />
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing['3xl'] },
    title: {
      marginTop: rnSpacing.sm,
      marginBottom: rnSpacing.md,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    scoreCard: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      alignItems: 'center',
      marginBottom: rnSpacing.md,
    },
    scoreCardPassed: { borderColor: tk.brandAccent.deep, backgroundColor: tk.success.light },
    scoreCardFailed: { borderColor: tk.border.light },
    scoreText: { fontSize: rnType.displayLg.size, fontWeight: '700', color: tk.text.primary },
    passedText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
    failedText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.danger.DEFAULT,
    },
    rankText: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    submittedAt: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.lg,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
