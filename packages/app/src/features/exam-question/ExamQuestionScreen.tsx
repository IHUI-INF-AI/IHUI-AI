// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  ExamQuestionItem,
  ExamQuestionPaper,
  ExamQuestionScreenProps,
  TFunction,
} from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { Tappable } from '@ihui/ui-native'

export type { ExamQuestionItem, ExamQuestionPaper, ExamQuestionScreenProps }

/**
 * 考试答题共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 试卷标题 + 倒计时)+ 进度 + 题型 + 题干 + 作答区
 * + 上一题/下一题/提交按钮。状态(answers/current/leftSec)由 wrapper 管理,
 * 共享层只调回调、不取数。平台特定(导航/API)由 wrapper 注入。
 *
 * 题型分支(对齐 web ExamAnswering):
 * - single / multi:选项行(行为与原实现一致,下标由 wrapper 序列化成选项 key);
 * - fill:单行 TextInput;subjective:多行 TextInput;
 * - judgment:两个互斥选项,取值布尔(文案 judgmentTrue/judgmentFalse)。
 */
export function ExamQuestionScreen({
  t,
  exam,
  loading,
  error,
  current,
  answers,
  onToggleOption,
  onAnswer,
  leftSec,
  submitting = false,
  onPrev,
  onNext,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: ExamQuestionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 必须排在条件 return 之前:输入框聚焦态是 Hook,放到下面会变成条件调用
  const [inputFocused, setInputFocused] = useState(false)

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !exam) {
    return (
      <ErrorState
        message={error || t('examQuestion.loadFailed')}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  const q = exam.questions[current]
  if (!q) {
    return (
      <ErrorState
        message={t('examQuestion.loadFailed')}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  const raw = answers[q.id]
  const selected = selectedIndexes(raw)
  const textValue = typeof raw === 'string' ? raw : ''
  const isLast = current >= exam.questions.length - 1
  const timerText =
    typeof leftSec === 'number'
      ? leftSec > 0
        ? t('examQuestion.timeLeft', { time: formatClock(leftSec) })
        : t('examQuestion.timeUp')
      : null

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title} numberOfLines={1}>
          {exam.title}
        </Text>
        {timerText ? (
          <Text
            style={[
              styles.timer,
              typeof leftSec === 'number' && leftSec <= 60 && styles.timerUrgent,
            ]}
          >
            {timerText}
          </Text>
        ) : null}
      </View>
      <Text style={styles.progress}>
        {current + 1}/{exam.questions.length}
      </Text>
      <Text style={styles.qType}>
        {typeLabel(t, q.type)}
        {typeof q.score === 'number' ? ` (${q.score})` : ''}
      </Text>
      <Text style={styles.qContent}>{q.content}</Text>
      {q.type === 'fill' || q.type === 'subjective' ? (
        <TextInput
          style={[
            styles.input,
            q.type === 'subjective' && styles.inputMultiline,
            inputFocused && styles.inputFocused,
          ]}
          value={textValue}
          onChangeText={(v) => onAnswer?.(q.id, v)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder={
            q.type === 'subjective'
              ? t('examQuestion.subjectivePlaceholder')
              : t('examQuestion.answerPlaceholder')
          }
          placeholderTextColor={tk.text.tertiary}
          multiline={q.type === 'subjective'}
          maxLength={q.type === 'subjective' ? 1000 : undefined}
          textAlignVertical={q.type === 'subjective' ? 'top' : 'center'}
        />
      ) : q.type === 'judgment' ? (
        <View style={styles.judgmentRow}>
          {[true, false].map((value) => {
            const active = typeof raw === 'boolean' && raw === value
            return (
              <Tappable
                key={String(value)}
                style={[styles.judgmentOption, active && styles.optionSelected]}
                onPress={() => onAnswer?.(q.id, value)}
              >
                <Text style={[styles.judgmentText, active && styles.optionTextSelected]}>
                  {value ? t('examQuestion.judgmentTrue') : t('examQuestion.judgmentFalse')}
                </Text>
              </Tappable>
            )
          })}
        </View>
      ) : (
        q.options.map((opt, idx) => {
          const active = selected.includes(idx)
          return (
            <Tappable
              key={idx}
              style={[styles.option, active && styles.optionSelected]}
              onPress={() => onToggleOption(q.id, idx, q.type === 'multi')}
            >
              <Text style={[styles.optionText, active && styles.optionTextSelected]}>
                {String.fromCharCode(65 + idx)}. {opt}
              </Text>
            </Tappable>
          )
        })
      )}
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.navBtn, current === 0 && styles.navDisabled]}
          onPress={onPrev}
          disabled={current === 0}
        >
          <Text style={styles.navText}>{t('examQuestion.prev')}</Text>
        </Pressable>
        {isLast ? (
          <Tappable
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={onSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitText}>{t('examQuestion.submit')}</Text>
          </Tappable>
        ) : (
          <Tappable style={styles.navBtn} onPress={onNext}>
            <Text style={styles.navText}>{t('examQuestion.next')}</Text>
          </Tappable>
        )}
      </View>
    </ScrollView>
  )
}

/** 选项题答案取 0-based 下标数组(非数组/字符串数组一律视为未选) */
function selectedIndexes(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : []
}

/** 秒 → mm:ss(倒计时展示;负数按 0 处理) */
function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 题型标签;判断题无独立词条,取两个选项词拼合 */
function typeLabel(t: TFunction, type: ExamQuestionItem['type']): string {
  switch (type) {
    case 'multi':
      return t('examQuestion.multi')
    case 'fill':
      return t('examQuestion.fill')
    case 'subjective':
      return t('examQuestion.subjective')
    case 'judgment':
      return `${t('examQuestion.judgmentTrue')}/${t('examQuestion.judgmentFalse')}`
    default:
      return t('examQuestion.single')
  }
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing['3xl'],
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.md },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    timer: {
      flexShrink: 0,
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.text.tertiary,
      fontVariant: ['tabular-nums'],
    },
    timerUrgent: { color: tk.danger.DEFAULT },
    progress: {
      marginTop: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.success.DEFAULT,
      fontWeight: '600',
    },
    qType: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    qContent: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.lg,
    },
    option: {
      padding: 14,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.sm,
    },
    optionSelected: { borderColor: tk.success.DEFAULT, backgroundColor: tk.success.light },
    optionText: { fontSize: rnType.title.size, color: tk.text.medium },
    optionTextSelected: { color: tk.success.DEFAULT, fontWeight: '500' },
    input: {
      minHeight: 46,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
      fontSize: rnType.title.size,
      color: tk.text.primary,
    },
    inputMultiline: { minHeight: 132 },
    // 聚焦反馈:只换描边色,不碰几何(门 212 RN 档禁几何键)
    inputFocused: { borderColor: tk.brandAccent.DEFAULT },
    judgmentRow: { flexDirection: 'row', gap: rnSpacing.sm },
    judgmentOption: {
      flex: 1,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
    },
    judgmentText: { fontSize: rnType.title.size, color: tk.text.medium },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.lg,
    },
    navBtn: {
      flex: 1,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navDisabled: { opacity: 0.4 },
    navText: { fontSize: rnType.title.size, color: tk.text.medium },
    submitBtn: {
      flex: 1,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
