import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AigcPublishFile, AigcPublishScreenProps, AigcPublishWorkType } from '../../types'

/** AIGC 发布作品共享屏 — 表单型 props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AigcPublishFile, AigcPublishScreenProps, AigcPublishWorkType }

interface WorkTypeOption {
  key: AigcPublishWorkType
  labelKey: string
  descKey: string
}

const TYPE_OPTIONS: WorkTypeOption[] = [
  { key: 'image', labelKey: 'aigcPublish.typeImage', descKey: 'aigcPublish.typeImageDesc' },
  { key: 'video', labelKey: 'aigcPublish.typeVideo', descKey: 'aigcPublish.typeVideoDesc' },
  { key: 'audio', labelKey: 'aigcPublish.typeAudio', descKey: 'aigcPublish.typeAudioDesc' },
  { key: 'text', labelKey: 'aigcPublish.typeText', descKey: 'aigcPublish.typeTextDesc' },
]

export function AigcPublishScreen({
  t,
  workType,
  files,
  textContent,
  title,
  description,
  prompt,
  urlInput,
  saving,
  uploading,
  error,
  onWorkTypeChange,
  onTextContentChange,
  onTitleChange,
  onDescriptionChange,
  onPromptChange,
  onUrlInputChange,
  onAddFileByUrl,
  onPickImage,
  onRemoveFile,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: AigcPublishScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const showTextInput = workType === 'text'

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backText}>{t('aigcPublish.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('aigcPublish.title')}</Text>
      <Text style={styles.subtitle}>{t('aigcPublish.subtitle')}</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.label}>{t('aigcPublish.labelType')}</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.typeChip, workType === opt.key && styles.typeChipActive]}
            onPress={() => onWorkTypeChange(opt.key)}
          >
            <Text style={[styles.typeChipText, workType === opt.key && styles.typeChipTextActive]}>
              {t(opt.labelKey)}
            </Text>
            <Text style={[styles.typeChipDesc, workType === opt.key && styles.typeChipDescActive]}>
              {t(opt.descKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showTextInput ? (
        <>
          <Text style={styles.label}>{t('aigcPublish.labelTextContent')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={textContent}
            onChangeText={onTextContentChange}
            placeholder={t('aigcPublish.placeholderTextContent')}
            placeholderTextColor={tk.text.tertiary}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>{t('aigcPublish.labelUpload', { count: files.length })}</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              value={urlInput}
              onChangeText={onUrlInputChange}
              placeholder={t('aigcPublish.placeholderUrl')}
              placeholderTextColor={tk.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.urlAddBtn} onPress={onAddFileByUrl} activeOpacity={0.7}>
              <Text style={styles.urlAddText}>{t('aigcPublish.urlAddBtn')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.pickerBtn, uploading && styles.pickerBtnDisabled]}
            onPress={onPickImage}
            disabled={uploading}
            activeOpacity={0.7}
          >
            {uploading ? (
              <View style={styles.pickerBtnInner}>
                <ActivityIndicator color={tk.surface.light} size="small" />
                <Text style={styles.pickerBtnTextUploading}>{t('aigcPublish.uploading')}</Text>
              </View>
            ) : (
              <Text style={styles.pickerBtnText}>{t('aigcPublish.pickFromAlbum')}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.fileGrid}>
            {files.map((f) => (
              <View key={f.id} style={styles.fileItem}>
                <Image source={{ uri: f.url }} style={styles.fileImage} resizeMode="cover" />
                <TouchableOpacity style={styles.fileRemove} onPress={() => onRemoveFile(f.id)}>
                  <Text style={styles.fileRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {files.length < 5 ? (
              <TouchableOpacity
                style={styles.fileAdd}
                onPress={onPickImage}
                disabled={uploading}
                activeOpacity={0.7}
              >
                <Text style={styles.fileAddIcon}>+</Text>
                <Text style={styles.fileAddText}>
                  {uploading ? t('aigcPublish.uploadingShort') : t('aigcPublish.fileAddText')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}

      <Text style={styles.label}>{t('aigcPublish.labelTitle')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={onTitleChange}
        placeholder={t('aigcPublish.placeholderTitle')}
        placeholderTextColor={tk.text.tertiary}
        maxLength={50}
      />

      <Text style={styles.label}>{t('aigcPublish.labelDescription')}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder={t('aigcPublish.placeholderDescription')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>{t('aigcPublish.labelPrompt')}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={prompt}
        onChangeText={onPromptChange}
        placeholder={t('aigcPublish.placeholderPrompt')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color={tk.surface.light} size="small" />
        ) : (
          <Text style={styles.submitText}>{t('aigcPublish.submitBtn')}</Text>
        )}
      </TouchableOpacity>
      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  const primary = tk.brand.DEFAULT
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.light,
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 16,
    },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary, marginBottom: 12 },
    label: { marginTop: 14, fontSize: 14, color: tk.text.secondary, marginBottom: 6 },
    errorText: { fontSize: 14, color: tk.error.text, marginTop: 8 },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    typeChipActive: { backgroundColor: primary },
    typeChipText: { fontSize: 14, color: tk.text.medium, fontWeight: '600' },
    typeChipTextActive: { color: tk.surface.light },
    typeChipDesc: { marginTop: 8, fontSize: 10, color: tk.text.tertiary },
    typeChipDescActive: { color: 'rgba(255,255,255,0.85)' },
    input: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 16,
      color: tk.text.primary,
      backgroundColor: '#f5f5f5',
    },
    textarea: { minHeight: 88, maxHeight: 180, textAlignVertical: 'top' },
    urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    urlInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: '#f5f5f5',
    },
    urlAddBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: primary,
    },
    urlAddText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    pickerBtn: {
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: primary,
      backgroundColor: tk.surface.light,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    pickerBtnDisabled: {
      opacity: 0.6,
      borderColor: tk.text.tertiary,
      backgroundColor: tk.text.tertiary,
    },
    pickerBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pickerBtnText: { color: primary, fontSize: 14, fontWeight: '600' },
    pickerBtnTextUploading: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    fileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    fileItem: {
      width: 76,
      height: 76,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.border.light,
    },
    fileImage: { width: '100%', height: '100%' },
    fileRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 12,
      backgroundColor: tk.error.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileRemoveText: { color: tk.surface.light, fontSize: 14, fontWeight: '700', lineHeight: 14 },
    fileAdd: {
      width: 76,
      height: 76,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    fileAddIcon: { fontSize: 24, color: tk.text.tertiary, lineHeight: 26 },
    fileAddText: { fontSize: 11, color: tk.text.tertiary, marginTop: 8 },
    submitBtn: {
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
