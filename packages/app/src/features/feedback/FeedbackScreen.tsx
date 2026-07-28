import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import type { FeedbackScreenProps, FeedbackType } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

const FEEDBACK_TYPES: FeedbackType[] = ['bug', 'suggestion', 'question', 'other']

/** i18n 键映射 — 消除 `t(\`type_${var}\`)` 动态拼接,与 shared i18n camelCase 键名对齐 */
const FEEDBACK_TYPE_KEYS: Record<FeedbackType, string> = {
  bug: 'feedback.typeBug',
  suggestion: 'feedback.typeSuggestion',
  question: 'feedback.typeQuestion',
  other: 'feedback.typeOther',
}

/**
 * FeedbackScreen — 跨端共享「意见反馈」页。
 *
 * 平台无关:用 react-native primitives 编写,web 端 react-native-web 渲染,RN 端原生渲染。
 * i18n 通过 `t` 注入,导航通过 `onBack` 注入,API 调用通过 `onSubmit` 注入。
 * 配色:由 colorScheme prop('light' | 'dark',默认 'light')经 getTokens 解析为明/暗 token 集。
 *
 * i18n 键来源:@ihui/i18n/messages/shared/{zh-CN,en,ja,ko,zh-TW}.json 的 feedback 命名空间。
 */
export function FeedbackScreen({
  t,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: FeedbackScreenProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError(t('feedback.contentRequired'))
      setSuccess('')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const ok = await onSubmit({ type, content: content.trim(), contact: contact.trim() })
      if (ok) {
        setSuccess(t('feedback.success'))
        setContent('')
        setContact('')
      } else {
        setError(t('feedback.failed'))
      }
    } catch {
      setError(t('feedback.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('feedback.title')}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('feedback.type')}</Text>
          <View style={styles.typeRow}>
            {FEEDBACK_TYPES.map((tp) => (
              <TouchableOpacity
                key={tp}
                onPress={() => setType(tp)}
                style={[styles.typeBtn, type === tp && styles.typeBtnActive]}
              >
                <Text style={[styles.typeText, type === tp && styles.typeTextActive]}>
                  {t(FEEDBACK_TYPE_KEYS[tp])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('feedback.content')}</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={t('feedback.contentPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            multiline
            style={styles.textarea}
          />

          <Text style={styles.label}>{t('feedback.contact')}</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder={t('feedback.contactPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            style={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          >
            <Text style={styles.submitText}>
              {submitting ? t('feedback.submitting') : t('feedback.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    body: { padding: 16 },
    card: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    label: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    typeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
    },
    typeBtnActive: { backgroundColor: tk.brand.DEFAULT },
    typeText: { fontSize: 12, color: tk.text.secondary },
    typeTextActive: { color: tk.surface.light },
    textarea: {
      marginTop: 4,
      minHeight: 80,
      padding: 8,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      color: tk.text.primary,
      fontSize: 13,
    },
    input: {
      marginTop: 4,
      padding: 8,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      color: tk.text.primary,
      fontSize: 13,
    },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, marginTop: 8 },
    successText: { fontSize: 12, color: tk.success.DEFAULT, marginTop: 8 },
    submitBtn: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
  })
}
