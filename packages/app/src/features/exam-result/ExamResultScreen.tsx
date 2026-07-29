import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamResultItem, ExamResultScreenProps } from '../../types'

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
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('examResult.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
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
    content: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
    back: { fontSize: 14, color: tk.text.medium },
    title: {
      marginTop: 8,
      marginBottom: 12,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
    },
    scoreCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      marginBottom: 12,
    },
    scoreCardPassed: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.success.light },
    scoreCardFailed: { borderColor: tk.border.light },
    scoreText: { fontSize: 32, fontWeight: '600', color: tk.text.primary },
    passedText: { marginTop: 4, fontSize: 14, fontWeight: '600', color: tk.brand.DEFAULT },
    failedText: { marginTop: 4, fontSize: 14, fontWeight: '600', color: tk.danger.DEFAULT },
    metaRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
    metaPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
    },
    metaPillText: { fontSize: 12, color: tk.text.primary },
    submittedAt: { fontSize: 11, color: tk.text.tertiary, marginBottom: 16 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 8,
    },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      marginBottom: 8,
    },
    question: { fontSize: 13, fontWeight: '500', color: tk.text.primary },
    yourAnswer: { marginTop: 6, fontSize: 12, color: tk.danger.DEFAULT },
    correctAnswer: { marginTop: 2, fontSize: 12, color: tk.brand.DEFAULT },
  })
}
