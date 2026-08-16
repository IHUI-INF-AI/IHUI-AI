import { useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseQAAskScreenProps } from '../../types'

/** 课程问答提问共享屏 — props 注入式跨端组件 */
export type { CourseQAAskScreenProps }

export function CourseQAAskScreen({
  t,
  question,
  submitting,
  error,
  success,
  onQuestionChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: CourseQAAskScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('courseQAAsk.title')}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>{t('courseQAAsk.question')}</Text>
        <TextInput
          style={styles.textarea}
          value={question}
          onChangeText={onQuestionChange}
          placeholder={t('courseQAAsk.placeholder')}
          placeholderTextColor={tk.text.tertiary}
          multiline
          textAlignVertical="top"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.toast}>{t('courseQAAsk.success')}</Text> : null}
        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={submitting}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {submitting ? (
            <ActivityIndicator color={tk.surface.light} />
          ) : (
            <Text style={styles.btnText}>{t('courseQAAsk.submit')}</Text>
          )}
        </TouchableOpacity>
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    body: { padding: 10 },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    label: { fontSize: 14, color: tk.text.secondary },
    textarea: {
      marginTop: 6,
      minHeight: 120,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: '#f5f5f5',
      fontSize: 16,
      color: tk.text.primary,
    },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginTop: 8 },
    toast: { fontSize: 14, color: tk.success.DEFAULT, marginTop: 8 },
    btn: {
      marginTop: 16,
      backgroundColor: tk.brand.DEFAULT,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
