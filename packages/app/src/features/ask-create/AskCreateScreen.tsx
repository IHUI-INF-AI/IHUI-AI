// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AskCreateScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { assertRequiredPort } from '../../host/ports'
import { AskImageField, ASK_IMAGE_MAX } from './AskImageField'
import { useAskDraft } from './ask-draft'

/**
 * 问答创建共享屏 — props 注入式跨端组件(状态由 wrapper 管理)。
 *
 * 2026-11-07 补两条共享能力槽(两端真传,共享层零平台 API):
 * - `media`:配图选图,内部交给共享段 AskImageField,点"+"才调,取消/失败不弹错;
 * - `draft`:草稿自动保存,内部交给共享钩子 useAskDraft,挂载恢复一次 + 防抖 800ms 落盘。
 */
export type { AskCreateScreenProps }

export function AskCreateScreen({
  t,
  title,
  content,
  tags,
  saving,
  error,
  onTitleChange,
  onContentChange,
  onTagsChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
  onToast,
  media,
  draft,
}: AskCreateScreenProps) {
  assertRequiredPort('onToast', onToast)
  assertRequiredPort('media', media)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 配图状态仍归共享屏:RN 端此前无配图段,提交体也不带 images(与 miniapp 提交面同构)
  const [images, setImages] = useState<string[]>([])
  // 只有用户真编辑过才落草稿:避免挂载时的空值覆盖尚未异步读回的旧草稿
  const touchedRef = useRef(false)

  const { save } = useAskDraft<{ title: string; content: string; tags: string }>({
    draft,
    onRestore: (saved) => {
      if (typeof saved.title === 'string') onTitleChange(saved.title)
      if (typeof saved.content === 'string') onContentChange(saved.content)
      if (typeof saved.tags === 'string') onTagsChange(saved.tags)
    },
  })

  useEffect(() => {
    if (!touchedRef.current) return
    save({ title, content, tags })
  }, [title, content, tags])

  const handleTitleChange = (text: string) => {
    touchedRef.current = true
    onTitleChange(text)
  }
  const handleContentChange = (text: string) => {
    touchedRef.current = true
    onContentChange(text)
  }
  const handleTagsChange = (text: string) => {
    touchedRef.current = true
    onTagsChange(text)
  }

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
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{t('askCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('askCreate.titleLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={styles.input}
        value={title}
        onChangeText={handleTitleChange}
        placeholder={t('askCreate.titlePlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('askCreate.contentLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={[styles.input, styles.textarea]}
        value={content}
        onChangeText={handleContentChange}
        placeholder={t('askCreate.contentPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.label}>{t('askCreate.tagsLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={styles.input}
        value={tags}
        onChangeText={handleTagsChange}
        placeholder={t('askCreate.tagsPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      {/* 配图共享段:文案键取 RN 既有发布图文案,不新增词条 */}
      <Text style={styles.label}>{t('publishNew.formatImage')}</Text>
      <AskImageField
        colorScheme={colorScheme}
        maxToast={t('aigcPublish.errorMaxFiles', { max: ASK_IMAGE_MAX })}
        images={images}
        media={media}
        onToast={onToast}
        onAdd={(uris) => setImages((prev) => [...prev, ...uris])}
        onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
      />
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.submitText}>
          {saving ? t('common.loading') : t('askCreate.submit')}
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
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing['3xl'],
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: rnSpacing.lg,
    },
    muted: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    error: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, marginBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    label: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.text.secondary },
    input: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    textarea: { minHeight: 120, maxHeight: 240 },
    submitBtn: {
      marginTop: rnSpacing.xl,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    submitDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { color: tk.surface.light, fontSize: rnType.title.size, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
