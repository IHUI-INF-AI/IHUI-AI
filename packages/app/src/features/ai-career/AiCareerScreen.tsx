// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AiCareerScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/** AI 生涯指导 — 孩子学业问卷共享屏(props 注入式跨端组件,纯 UI,不依赖平台 API) */
export type { AiCareerScreenProps }

export function AiCareerScreen({
  t,
  questions,
  formData,
  error,
  submitting,
  onSelectOption,
  onInputChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: AiCareerScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <BackChevron
        onPress={onBack}
        label={t('common.back')}
        colorScheme={colorScheme}
        style={styles.backBtn}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI生涯指导</Text>
        <Text style={styles.headerSub}>填写孩子学业情况问卷，提交后获取 AI 学业建议</Text>
      </View>

      {questions.map((q) => (
        <View
          key={q.key}
          style={[styles.questionCard, q.section === 'personality' && styles.personalityCard]}
        >
          <Text style={styles.questionTitle}>
            {q.required ? <Text style={styles.required}>* </Text> : null}
            {q.title}
          </Text>

          {(q.type === 'choice' || q.type === 'score') && (
            <View style={q.type === 'score' ? styles.scoreRow : styles.optionsContainer}>
              {(q.options ?? []).map((opt) => {
                const active = formData[q.key] === opt.value
                if (q.type === 'score') {
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.scoreItem, active && styles.optionItemActive]}
                      onPress={() => onSelectOption(q.key, opt.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.scoreText, active && styles.optionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                }
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionItem, active && styles.optionItemActive]}
                    onPress={() => onSelectOption(q.key, opt.value)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {(q.type === 'input' || q.type === 'textarea') && (
            <TextField
              colorScheme={colorScheme}
              style={q.type === 'textarea' ? styles.textareaInput : styles.inputField}
              value={formData[q.key]}
              onChangeText={(value) => onInputChange(q.key, value)}
              placeholder={q.placeholder}
              placeholderTextColor={tk.text.tertiary}
              maxLength={q.maxLength}
              multiline={q.type === 'textarea'}
              textAlignVertical={q.type === 'textarea' ? 'top' : 'center'}
            />
          )}
        </View>
      ))}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.9}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? t('common.submitting') : '提交问卷'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { padding: rnSpacing.lg, paddingBottom: rnSpacing['3xl'] },
    backBtn: { paddingBottom: rnSpacing.xs },
    header: { paddingTop: rnSpacing.xs, paddingBottom: rnSpacing.lg },
    headerTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    headerSub: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      lineHeight: 20,
    },
    questionCard: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.md,
    },
    personalityCard: { backgroundColor: tk.surface.muted },
    questionTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      lineHeight: 24,
      marginBottom: 14,
    },
    required: { color: tk.danger.DEFAULT },
    optionsContainer: { gap: 10 },
    optionItem: {
      paddingVertical: rnSpacing.md,
      paddingHorizontal: 14,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    optionItemActive: {
      backgroundColor: tk.brand.cta,
      borderColor: tk.brandAccent.deep,
    },
    optionText: {
      fontSize: rnType.strong.size,
      color: tk.text.medium,
      lineHeight: 22,
    },
    optionTextActive: { color: tk.surface.light },
    scoreRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    scoreItem: {
      flex: 1,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    scoreText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.medium },
    inputField: {
      height: 44,
      paddingHorizontal: 14,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.strong.size,
      color: tk.text.primary,
    },
    textareaInput: {
      minHeight: 120,
      padding: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.strong.size,
      color: tk.text.primary,
      lineHeight: 22,
    },
    errorText: { color: tk.danger.DEFAULT, fontSize: rnType.body.size, marginBottom: rnSpacing.sm },
    submitContainer: {
      paddingVertical: rnSpacing['2xl'],
      alignItems: 'center',
    },
    submitBtn: {
      width: '100%',
      height: 48,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnText: { fontSize: 17, fontWeight: '700', color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
