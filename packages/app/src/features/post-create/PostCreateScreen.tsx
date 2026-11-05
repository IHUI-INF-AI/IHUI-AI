// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PostCreateScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useUiField } from '@ihui/shared/ui-control/field-registry'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/** 发帖共享屏 — props 注入式跨端组件(表单类) */
export type { PostCreateScreenProps }

export function PostCreateScreen({
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
}: PostCreateScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /**
   * AI 操控通道(2026-11-06 端内能力下沉):三个输入框由**渲染它们的本屏**交出
   * 「当下值 + 组件真正绑定的 setter」。
   *
   * 为什么住这里:控件注册表只要求「谁渲染输入框,谁交出写通道」——注册核
   * (`@ihui/shared/ui-control/field-registry`)只依赖 React 与 Map,零平台 API,小程序与 RN
   * 拿到的是同一个模块实例;而输入框住在本屏,把它交给端内页去登记,等于「界面在屏上、
   * 通道在页里」两处真相(§0.6)。端内薄壳页此前自带这三枚登记(小程序 create/index.tsx),
   * 屏没有承接 ⇒ 一旦转承载,AI 侧的症状是「这三个框填不了」这种无声能力缺失。
   *
   * 与端内登记面逐条同形:kind / label / placeholder / readValue / setValue 一致,
   * group 缺省 'page' 一致;`saving` 早返回不摘通道(端内也是同序,行为零漂移)。
   *
   * 提交(发布到社区)是对外发声且不可逆的动作:按钮与表单都不交出通道,
   * 注册表的 DESTRUCTIVE_TEXT_RE 另有「发布/post」一层兜底 —— 两层判据都不依赖对方。
   */
  useUiField({
    kind: 'input',
    label: t('postCreate.titleLabel'),
    placeholder: t('postCreate.titlePlaceholder'),
    readValue: () => title,
    setValue: onTitleChange,
  })
  useUiField({
    kind: 'textarea',
    label: t('postCreate.contentLabel'),
    placeholder: t('postCreate.contentPlaceholder'),
    readValue: () => content,
    setValue: onContentChange,
  })
  useUiField({
    kind: 'input',
    label: t('postCreate.tagsLabel'),
    placeholder: t('postCreate.tagsPlaceholder'),
    readValue: () => tags,
    setValue: onTagsChange,
  })

  if (saving) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{t('postCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('postCreate.titleLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={styles.input}
        value={title}
        onChangeText={onTitleChange}
        placeholder={t('postCreate.titlePlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('postCreate.contentLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={[styles.input, styles.textarea]}
        value={content}
        onChangeText={onContentChange}
        placeholder={t('postCreate.contentPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
        multiline
        textAlignVertical="top"
      />
      <Text style={styles.label}>{t('postCreate.tagsLabel')}</Text>
      <TextField
        colorScheme={colorScheme}
        style={styles.input}
        value={tags}
        onChangeText={onTagsChange}
        placeholder={t('postCreate.tagsPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
      />
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.submitText}>{t('postCreate.submit')}</Text>
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
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    error: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, marginBottom: rnSpacing.sm },
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
