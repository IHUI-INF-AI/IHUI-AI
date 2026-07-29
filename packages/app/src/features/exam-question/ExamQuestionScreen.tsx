import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamQuestionItem, ExamQuestionPaper, ExamQuestionScreenProps } from '../../types'

export type { ExamQuestionItem, ExamQuestionPaper, ExamQuestionScreenProps }

/**
 * 考试答题共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 试卷标题)+ 进度 + 题型 + 题干 + 选项
 * + 上一题/下一题/提交按钮。状态(answers/current)由 wrapper 管理,
 * 共享层只调回调。平台特定(导航/API)由 wrapper 注入。
 */
export function ExamQuestionScreen({
  t,
  exam,
  loading,
  error,
  current,
  answers,
  onToggleOption,
  onPrev,
  onNext,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: ExamQuestionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.success.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !exam) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('examQuestion.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const q = exam.questions[current]
  if (!q) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('examQuestion.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const selected = answers[q.id] ?? []
  const isLast = current >= exam.questions.length - 1

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {exam.title}
        </Text>
      </View>
      <Text style={styles.progress}>
        {current + 1}/{exam.questions.length}
      </Text>
      <Text style={styles.qType}>
        {q.type === 'multi' ? t('examQuestion.multi') : t('examQuestion.single')}
      </Text>
      <Text style={styles.qContent}>{q.content}</Text>
      {q.options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.option, selected.includes(idx) && styles.optionSelected]}
          onPress={() => onToggleOption(q.id, idx, q.type === 'multi')}
        >
          <Text style={[styles.optionText, selected.includes(idx) && styles.optionTextSelected]}>
            {String.fromCharCode(65 + idx)}. {opt}
          </Text>
        </TouchableOpacity>
      ))}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.navBtn, current === 0 && styles.navDisabled]}
          onPress={onPrev}
          disabled={current === 0}
        >
          <Text style={styles.navText}>{t('examQuestion.prev')}</Text>
        </TouchableOpacity>
        {isLast ? (
          <TouchableOpacity style={styles.submitBtn} onPress={onSubmit}>
            <Text style={styles.submitText}>{t('examQuestion.submit')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.navBtn} onPress={onNext}>
            <Text style={styles.navText}>{t('examQuestion.next')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 32,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    progress: { marginTop: 12, fontSize: 12, color: tk.success.DEFAULT, fontWeight: '600' },
    qType: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    qContent: {
      marginTop: 8,
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
      marginBottom: 16,
    },
    option: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    optionSelected: { borderColor: tk.success.DEFAULT, backgroundColor: tk.success.light },
    optionText: { fontSize: 14, color: tk.text.medium },
    optionTextSelected: { color: tk.success.DEFAULT, fontWeight: '500' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 16 },
    navBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    navDisabled: { opacity: 0.4 },
    navText: { fontSize: 14, color: tk.text.medium },
    submitBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    submitText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
  })
}
