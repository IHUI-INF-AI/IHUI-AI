// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import type { FeedbackScreenProps, FeedbackType } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/** 问题截图最多张数(对齐 Uniapp fankui「最多9张」) */
const MAX_IMAGES = 9

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
  onPickImages,
  colorScheme = 'light',
}: FeedbackScreenProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  // 问题截图(对齐 Uniapp fankui filePaths,最多 9 张)
  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const handlePickImages = async () => {
    if (!onPickImages) return
    try {
      const picked = await onPickImages()
      if (picked.length > 0) {
        setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES))
        setError('')
        setSuccess('')
      }
    } catch {
      setError(t('feedback.imagePickFailed'))
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

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
      const ok = await onSubmit({
        type,
        content: content.trim(),
        contact: contact.trim(),
        images: images.length > 0 ? images : undefined,
      })
      if (ok) {
        setSuccess(t('feedback.success'))
        setContent('')
        setContact('')
        setImages([])
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

          {/* 问题截图上传(对齐 Uniapp fankui「请在此上传你所遇到问题的截图(最多9张)」;未注入选图回调则不渲染) */}
          {onPickImages ? (
            <View style={styles.imageSection}>
              <Text style={styles.label}>{t('feedback.imagesLabel')}</Text>
              <View style={styles.imageRow}>
                {images.map((img, index) => (
                  <View key={`${img}-${index}`} style={styles.imageItem}>
                    <Image source={{ uri: img }} style={styles.imageThumb} resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => handleRemoveImage(index)}
                      style={styles.imageRemove}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={t('common.remove')}
                    >
                      <Text style={styles.imageRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < MAX_IMAGES ? (
                  <TouchableOpacity
                    onPress={handlePickImages}
                    style={styles.imageAdd}
                    activeOpacity={0.7}
                    accessibilityLabel={t('feedback.pickImages')}
                  >
                    <Text style={styles.imageAddText}>＋</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14 },
    card: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    label: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    typeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
    },
    typeBtnActive: { backgroundColor: tk.brand.DEFAULT },
    typeText: { fontSize: 14, color: tk.text.secondary },
    typeTextActive: { color: tk.surface.light },
    textarea: {
      marginTop: 8,
      minHeight: 80,
      padding: 12,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      color: tk.text.primary,
      fontSize: 14,
    },
    input: {
      marginTop: 8,
      height: 50,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      color: tk.text.primary,
      fontSize: 14,
    },
    imageSection: { marginTop: 12 },
    imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    imageItem: { position: 'relative' },
    imageThumb: {
      width: 70, // 140rpx
      height: 70,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
    },
    imageRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageRemoveText: { color: tk.surface.light, fontSize: 14, lineHeight: 18 },
    imageAdd: {
      width: 70,
      height: 70,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageAddText: { fontSize: 24, color: tk.text.tertiary },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, marginTop: 8 },
    successText: { fontSize: 14, color: tk.success.DEFAULT, marginTop: 8 },
    submitBtn: {
      marginTop: 12,
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
