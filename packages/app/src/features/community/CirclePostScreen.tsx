// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Plus, X } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/**
 * 圈子发帖共享屏 —— 承载 web /circles/post(同口径:选圈/标题/正文/图片≤9/校验文案)。
 * 平台无关:取数(圈子列表)、图片选择与上传、提交(POST /api/circles/:id/posts)全部由薄壳注入。
 */
export interface CircleOption {
  id: string
  name: string
}

export interface CirclePostImage {
  key: string
  /** 已解析为绝对 URL 的缩略图地址(上传成功后由薄壳回填) */
  uri: string
}

export interface CirclePostScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  circles: CircleOption[]
  circlesLoading: boolean
  selectedCircleId: string
  onSelectCircle: (id: string) => void
  title: string
  onTitleChange: (value: string) => void
  content: string
  onContentChange: (value: string) => void
  images: CirclePostImage[]
  onPickImage: () => void
  onRemoveImage: (key: string) => void
  uploading: boolean
  error: string | null
  submitting: boolean
  onSubmit: () => void
  onCancel: () => void
}

const MAX_IMAGES = 9

export function CirclePostScreen({
  t,
  colorScheme,
  onBack,
  circles,
  circlesLoading,
  selectedCircleId,
  onSelectCircle,
  title,
  onTitleChange,
  content,
  onContentChange,
  images,
  onPickImage,
  onRemoveImage,
  uploading,
  error,
  submitting,
  onSubmit,
  onCancel,
}: CirclePostScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('circlePostPage.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('circlePostPage.title')}</Text>
      </View>
      <Text style={styles.cardTitle}>{t('circlePostPage.cardTitle')}</Text>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.label}>{t('circlePostPage.selectCircle')}</Text>
          {circlesLoading ? (
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          ) : (
            <View style={styles.chipWrap}>
              {circles.map((c) => {
                const active = c.id === selectedCircleId
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => onSelectCircle(c.id)}
                    style={active ? styles.chipActive : styles.chip}
                  >
                    <Text style={active ? styles.chipTextActive : styles.chipText}>{c.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('circlePostPage.titleLabel')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={title}
            onChangeText={onTitleChange}
            placeholder={t('circlePostPage.titlePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            maxLength={200}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('circlePostPage.contentLabel')}</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.textarea}
            multiline
            value={content}
            onChangeText={onContentChange}
            placeholder={t('circlePostPage.contentPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('circlePostPage.images')}</Text>
          <View style={styles.imageRow}>
            {images.map((img) => (
              <View key={img.key} style={styles.thumbBox}>
                <Image source={{ uri: img.uri }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => onRemoveImage(img.key)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={14} color={tk.surface.light} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES ? (
              <TouchableOpacity
                style={styles.thumbAdd}
                onPress={onPickImage}
                disabled={uploading || images.length >= MAX_IMAGES}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={tk.text.tertiary} />
                ) : (
                  <Plus size={22} color={tk.text.tertiary} />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={submitting}>
            <Text style={styles.submitText}>{t('circlePostPage.submit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
            <Text style={styles.cancelText}>{t('circlePostPage.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    title: { flex: 1, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    cardTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginTop: rnSpacing.lg,
    },
    scroll: { paddingBottom: 24 },
    section: { marginTop: rnSpacing.md },
    label: {
      fontSize: rnType.body.size,
      fontWeight: '500',
      color: tk.text.primary,
      marginBottom: rnSpacing.xs,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    chipActive: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    chipText: { fontSize: rnType.body.size, color: tk.text.medium },
    chipTextActive: {
      fontSize: rnType.body.size,
      color: tk.brand.ctaForeground,
      fontWeight: '500',
    },
    input: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 12,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    textarea: {
      minHeight: 140,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    thumbBox: {
      width: 84,
      height: 84,
      borderRadius: rnRadius.md,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
    },
    thumb: { width: '100%', height: '100%' },
    thumbRemove: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 20,
      height: 20,
      borderRadius: rnRadius.xs,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.overlay.modal,
    },
    thumbAdd: {
      width: 84,
      height: 84,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    error: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    actions: { flexDirection: 'row', gap: rnSpacing.md, marginTop: rnSpacing.lg },
    submitBtn: {
      paddingHorizontal: rnSpacing.xl,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    submitText: { color: tk.brand.ctaForeground, fontSize: rnType.body.size, fontWeight: '600' },
    cancelBtn: {
      paddingHorizontal: rnSpacing.xl,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    cancelText: { color: tk.text.primary, fontSize: rnType.body.size },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
