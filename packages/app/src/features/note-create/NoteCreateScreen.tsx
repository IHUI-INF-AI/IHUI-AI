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
import type { NoteCreateScreenProps } from '../../types'

/** 笔记创建共享屏 — props 注入式跨端组件(状态由 wrapper 管理,isPublic 用模拟 Switch) */
export type { NoteCreateScreenProps }

export function NoteCreateScreen({
  t,
  title,
  content,
  tags,
  isPublic,
  saving,
  error,
  onTitleChange,
  onContentChange,
  onTagsChange,
  onTogglePublic,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: NoteCreateScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (saving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('noteCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('noteCreate.titleLabel')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={onTitleChange}
        placeholder={t('noteCreate.titlePlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('noteCreate.contentLabel')}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={content}
        onChangeText={onContentChange}
        placeholder={t('noteCreate.contentPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.label}>{t('noteCreate.tagsLabel')}</Text>
      <TextInput
        style={styles.input}
        value={tags}
        onChangeText={onTagsChange}
        placeholder={t('noteCreate.tagsPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <TouchableOpacity style={styles.visibilityRow} onPress={onTogglePublic}>
        <Text style={styles.visibilityLabel}>{t('noteCreate.isPublic')}</Text>
        <View style={[styles.switchTrack, isPublic ? styles.switchTrackOn : styles.switchTrackOff]}>
          <View
            style={[styles.switchThumb, isPublic ? styles.switchThumbOn : styles.switchThumbOff]}
          />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.submitText}>
          {saving ? t('common.loading') : t('noteCreate.submit')}
        </Text>
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
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    label: { marginTop: 12, fontSize: 12, color: tk.text.secondary },
    input: {
      marginTop: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
    },
    textarea: { minHeight: 120, maxHeight: 240 },
    visibilityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    visibilityLabel: { fontSize: 14, color: tk.text.primary },
    switchTrack: { width: 44, height: 24, borderRadius: 8, padding: 2, justifyContent: 'center' },
    switchTrackOn: { backgroundColor: tk.success.DEFAULT },
    switchTrackOff: { backgroundColor: tk.text.tertiary },
    switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: tk.surface.light },
    switchThumbOn: { alignSelf: 'flex-end' },
    switchThumbOff: { alignSelf: 'flex-start' },
    submitBtn: {
      marginTop: 20,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    submitDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { color: tk.surface.light, fontSize: 15, fontWeight: '600' },
  })
}
