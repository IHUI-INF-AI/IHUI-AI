import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CircleCreateScreenProps } from '../../types'

/** 圈子创建共享屏 — props 注入式跨端组件(状态由 wrapper 管理) */
export type { CircleCreateScreenProps }

export function CircleCreateScreen({
  t,
  name,
  description,
  saving,
  error,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: CircleCreateScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (saving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('circleCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('circleCreate.name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={onNameChange}
        placeholder={t('circleCreate.namePlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('circleCreate.description')}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder={t('circleCreate.descPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.submitText}>
          {saving ? t('common.loading') : t('circleCreate.submit')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 10, paddingTop: 48, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tk.surface.bg, padding: 16 },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 8 },
    back: { fontSize: 16, color: tk.text.medium },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary, marginBottom: 12 },
    label: { marginTop: 12, fontSize: 14, color: tk.text.secondary },
    input: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: tk.border.light, fontSize: 16, color: tk.text.primary, backgroundColor: '#f5f5f5' },
    textarea: { minHeight: 100, maxHeight: 200 },
    submitBtn: { marginTop: 20, paddingVertical: 15, borderRadius: 12, backgroundColor: tk.brand.DEFAULT, alignItems: 'center' },
    submitDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
