import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentCreateScreenProps } from '../../types'

/** Agent 创建共享屏 — props 注入式跨端组件(表单,状态由 wrapper 管理) */
export type { AgentCreateScreenProps }

export function AgentCreateScreen({
  t,
  name,
  description,
  systemPrompt,
  category,
  isPublic,
  saving,
  error,
  onNameChange,
  onDescriptionChange,
  onSystemPromptChange,
  onCategoryChange,
  onTogglePublic,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: AgentCreateScreenProps) {
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
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('agentCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('agentCreate.name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={onNameChange}
        placeholder={t('agentCreate.namePlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('agentCreate.category')}</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={onCategoryChange}
        placeholder={t('agentCreate.categoryPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('agentCreate.description')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder={t('agentCreate.descPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.label}>{t('agentCreate.systemPrompt')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={systemPrompt}
        onChangeText={onSystemPromptChange}
        placeholder={t('agentCreate.promptPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />
      <TouchableOpacity style={styles.publicToggle} onPress={onTogglePublic}>
        <Text style={styles.publicLabel}>{t('agentCreate.isPublic')}</Text>
        <Text style={styles.publicValue}>
          {isPublic ? t('agentCreate.public') : t('agentCreate.private')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.submitBtn, saving ? styles.submitBtnDisabled : null]}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.submitBtnText}>{t('agentCreate.submit')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 48,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: tk.surface.bg,
    },
    muted: { fontSize: 13, color: tk.text.secondary, marginTop: 8 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: {
      marginTop: 8,
      marginBottom: 12,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
    },
    error: { marginBottom: 8, fontSize: 13, color: tk.error.text },
    label: { marginTop: 12, fontSize: 12, color: tk.text.secondary },
    input: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    inputMultiline: { minHeight: 80, maxHeight: 160 },
    publicToggle: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      padding: 12,
    },
    publicLabel: { fontSize: 14, color: tk.text.primary },
    publicValue: { fontSize: 13, fontWeight: '600', color: tk.brand.DEFAULT },
    submitBtn: {
      marginTop: 20,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: tk.surface.light, fontSize: 15, fontWeight: '600' },
  })
}
