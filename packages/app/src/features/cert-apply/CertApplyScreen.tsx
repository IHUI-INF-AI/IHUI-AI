import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertApplyScreenProps } from '../../types'

/** 证书申请共享屏 — props 注入式跨端组件(wrapper 负责 POST /certificates) */
export type { CertApplyScreenProps }

export function CertApplyScreen({
  t,
  name,
  idCard,
  submitting,
  error,
  success,
  onNameChange,
  onIdCardChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: CertApplyScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('certApply.title')}</Text>
      <Text style={styles.label}>{t('certApply.name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={onNameChange}
        placeholder={t('certApply.placeholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('certApply.idCard')}</Text>
      <TextInput
        style={styles.input}
        value={idCard}
        onChangeText={onIdCardChange}
        placeholder={t('certApply.placeholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{t('certApply.success')}</Text> : null}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={tk.surface.light} />
        ) : (
          <Text style={styles.submitText}>{t('certApply.submit')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary, marginBottom: 4 },
    label: { marginTop: 12, fontSize: 12, color: tk.text.secondary },
    input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light, fontSize: 14, color: tk.text.primary },
    error: { marginTop: 12, fontSize: 13, color: tk.danger.DEFAULT },
    success: { marginTop: 12, fontSize: 13, color: tk.success.DEFAULT },
    submitBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: tk.success.DEFAULT, alignItems: 'center' },
    btnDisabled: { opacity: 0.6 },
    submitText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
  })
}
