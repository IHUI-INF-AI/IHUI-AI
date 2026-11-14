// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
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

/** 分类选项:宿主已把 i18n key 取词成 label 再传,共享屏不碰 i18n */
export interface AskCategoryOption {
  key: string
  label: string
}

/**
 * 本端注入的可选受控段(2026-11-13 收敛):分类/悬赏/匿名/字数计数器。
 * 全部 optional —— miniapp 宿主真传,不传即整段不渲染 ⇒ RN wrapper 零行为变化。
 */
type AskCreateHostSegments = {
  categories?: AskCategoryOption[]
  category?: string
  onCategoryChange?: (key: string) => void
  rewards?: number[]
  reward?: number
  onRewardChange?: (value: number) => void
  anonymous?: boolean
  onAnonymousChange?: (value: boolean) => void
  titleMax?: number
  contentMax?: number
}

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
  categories,
  category,
  onCategoryChange,
  rewards,
  reward,
  onRewardChange,
  anonymous,
  onAnonymousChange,
  titleMax,
  contentMax,
}: AskCreateScreenProps & AskCreateHostSegments) {
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
        placeholderTextColor={tk.text.secondary}
      />
      {/* 字数计数器(可选):titleMax 未传则不渲染,RN 保持原样 */}
      {typeof titleMax === 'number' ? (
        <Text style={styles.counter}>
          {title.length}/{titleMax}
        </Text>
      ) : null}
      <Text style={styles.label}>{t('askCreate.contentLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={[styles.input, styles.textarea]}
        value={content}
        onChangeText={handleContentChange}
        placeholder={t('askCreate.contentPlaceholder')}
        placeholderTextColor={tk.text.secondary}
        multiline
        textAlignVertical="top"
      />
      {typeof contentMax === 'number' ? (
        <Text style={styles.counter}>
          {content.length}/{contentMax}
        </Text>
      ) : null}
      <Text style={styles.label}>{t('askCreate.tagsLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={styles.input}
        value={tags}
        onChangeText={handleTagsChange}
        placeholder={t('askCreate.tagsPlaceholder')}
        placeholderTextColor={tk.text.secondary}
      />
      {/* 分类段(可选):传了 categories 才渲染。有 onCategoryChange 时按 chip 条直选,
          否则降级为只读取值行(category 仅作回显,交互由宿主另接)。 */}
      {categories && categories.length > 0 ? (
        <View>
          <Text style={styles.label}>{t('ask.create.categoryLabel')}</Text>
          <View style={styles.chipRow}>
            {categories.map((opt) => {
              const active = category === opt.key
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onCategoryChange?.(opt.key)}
                  disabled={!onCategoryChange}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ) : null}
      {/* 悬赏积分段(可选):rewards 未传则不渲染 */}
      {rewards && rewards.length > 0 ? (
        <View>
          <Text style={styles.label}>{t('ask.create.rewardLabel')}</Text>
          <View style={styles.chipRow}>
            {rewards.map((value) => {
              const active = reward === value
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, styles.chipReward, active && styles.chipActive]}
                  onPress={() => onRewardChange?.(value)}
                  disabled={!onRewardChange}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{value}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ) : null}
      {/* 匿名发布段(可选):onAnonymousChange 未传则不渲染 */}
      {onAnonymousChange ? (
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.label}>{t('ask.create.anonymousLabel')}</Text>
            <Text style={styles.switchDesc}>{t('ask.create.anonymousDesc')}</Text>
          </View>
          <Switch
            value={anonymous === true}
            onValueChange={onAnonymousChange}
            trackColor={{ false: tk.border.medium, true: tk.brand.DEFAULT }}
            thumbColor={tk.surface.light}
          />
        </View>
      ) : null}
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
    error: { fontSize: rnType.body.size, color: tk.danger.deepText, marginBottom: rnSpacing.sm },
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
    submitDisabled: { backgroundColor: tk.text.secondary },
    submitText: { color: tk.surface.light, fontSize: rnType.title.size, fontWeight: '600' },
    counter: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.medium,
      textAlign: 'right',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm, marginTop: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.muted,
    },
    chipActive: { borderColor: tk.brand.cta, backgroundColor: tk.surface.light },
    chipText: { fontSize: rnType.body.size, color: tk.text.primary },
    chipTextActive: { color: tk.brand.cta, fontWeight: '600' },
    chipReward: { minWidth: 56, alignItems: 'center' },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.md,
    },
    switchInfo: { flex: 1, paddingRight: rnSpacing.md },
    switchDesc: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      color: tk.text.medium,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
