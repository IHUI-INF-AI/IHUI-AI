import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AiCareerScreenProps } from '../../types'

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
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
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
            <TextInput
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
    content: { padding: 16, paddingBottom: 32 },
    backBtn: { paddingBottom: 4 },
    back: { fontSize: 16, color: tk.text.secondary },
    header: { paddingTop: 4, paddingBottom: 16 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    headerSub: { marginTop: 8, fontSize: 14, color: tk.text.secondary, lineHeight: 20 },
    questionCard: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 12,
    },
    personalityCard: { backgroundColor: tk.surface.muted },
    questionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      lineHeight: 24,
      marginBottom: 14,
    },
    required: { color: tk.danger.DEFAULT },
    optionsContainer: { gap: 10 },
    optionItem: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    optionItemActive: {
      backgroundColor: tk.brand.DEFAULT,
      borderColor: tk.brand.DEFAULT,
    },
    optionText: {
      fontSize: 15,
      color: tk.text.medium,
      lineHeight: 22,
    },
    optionTextActive: { color: tk.surface.light },
    scoreRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    scoreItem: {
      flex: 1,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    scoreText: { fontSize: 16, fontWeight: '600', color: tk.text.medium },
    inputField: {
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 15,
      color: tk.text.primary,
    },
    textareaInput: {
      minHeight: 120,
      padding: 12,
      borderRadius: 10,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 15,
      color: tk.text.primary,
      lineHeight: 22,
    },
    errorText: { color: tk.danger.DEFAULT, fontSize: 14, marginBottom: 8 },
    submitContainer: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    submitBtn: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnText: { fontSize: 17, fontWeight: '700', color: tk.surface.light },
  })
}
