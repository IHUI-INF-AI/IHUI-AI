// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, Text, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamResultItem, ExamResultScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** ExamResult 共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { ExamResultItem, ExamResultScreenProps }

export function ExamResultScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: ExamResultScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }
  if (error || !item) {
    return (
      <ErrorState
        message={error || t('examResult.loadFailed')}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{item.examTitle}</Text>
      <View
        style={[styles.scoreCard, item.passed ? styles.scoreCardPassed : styles.scoreCardFailed]}
      >
        <Text style={styles.scoreText}>
          {item.score}/{item.totalScore}
        </Text>
        <Text style={item.passed ? styles.passedText : styles.failedText}>
          {item.passed ? t('examResult.passed') : t('examResult.failed')}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>
            {t('examResult.correct', { count: item.correctCount, total: item.totalCount })}
          </Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>
            {t('examResult.duration', { min: item.duration })}
          </Text>
        </View>
      </View>
      <Text style={styles.submittedAt}>{item.submittedAt}</Text>
      {item.wrongQuestions.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('examResult.wrongQuestions')}</Text>
          {item.wrongQuestions.map((q) => (
            <View key={q.index} style={styles.card}>
              <Text style={styles.question}>
                {q.index + 1}. {q.question}
              </Text>
              <Text style={styles.yourAnswer}>
                {t('examResult.yourAnswer')}: {q.yourAnswer}
              </Text>
              <Text style={styles.correctAnswer}>
                {t('examResult.correctAnswer')}: {q.correctAnswer}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { paddingHorizontal: 10, paddingBottom: rnSpacing['3xl'] },
    title: {
      marginTop: rnSpacing.sm,
      marginBottom: rnSpacing.md,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
    },
    scoreCard: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      alignItems: 'center',
      marginBottom: rnSpacing.md,
    },
    scoreCardPassed: { borderColor: tk.brandAccent.deep, backgroundColor: tk.success.light },
    scoreCardFailed: { borderColor: tk.border.light },
    scoreText: { fontSize: 36, fontWeight: '700', color: tk.text.primary },
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
    metaRow: { flexDirection: 'row', gap: rnSpacing.md, marginBottom: rnSpacing.sm },
    metaPill: {
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    metaPillText: { fontSize: rnType.body.size, color: tk.text.primary },
    submittedAt: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.lg,
    },
    sectionTitle: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.sm,
    },
    question: { fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    yourAnswer: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    correctAnswer: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.brand.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
