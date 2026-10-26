// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'
import { Globe2, Save } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { AppThemeTokens } from '../../theme/tokens'
import { getTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'

/** 编辑表单受控值(与 web ai-world/edit/[id] 表单字段对齐;config 后端 zod 不存在,不提供) */
export interface AiWorldEditFormState {
  name: string
  description: string
  categoryId: string
  coverImage: string
}

/** 分类选项(GET /api/ai-world/categories 行) */
export interface AiWorldEditCategoryOption {
  id: string
  name: string
}

export interface AiWorldEditScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  /** 条目首次加载中(水合前) */
  loading: boolean
  /** 条目加载/保存错误(非空显示整屏错误+重试) */
  error: string
  onRetry: () => void
  form: AiWorldEditFormState
  onChange: (patch: Partial<AiWorldEditFormState>) => void
  /** 表单内联校验错误(名称必填等) */
  formError: string
  categories: AiWorldEditCategoryOption[]
  categoriesLoading: boolean
  categoriesError: string
  onRetryCategories: () => void
  saving: boolean
  onSubmit: () => void
}

/**
 * AiWorldEditScreen AI 世界条目编辑(共享层)
 *
 * 2026-10-26 Wave2 补屏立,承载 web `/ai-world/edit/[id]`(apps/web/app/(main)/ai-world/edit/[id]/PageClient.tsx):
 * 表单结构沿用本域 AiWorldCreateScreen 的字段布局(名称/描述/分类 chips/封面),
 * 提交改走 PUT /api/ai-world/:id。web 表单的 config 字段后端 zod 不存在(静默 strip),
 * 与 RN 创建屏同口径不提供。取数、水合、导航由 wrapper 注入。
 */
export function AiWorldEditScreen({
  t,
  colorScheme = 'light',
  onBack,
  loading,
  error,
  onRetry,
  form,
  onChange,
  formError,
  categories,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  saving,
  onSubmit,
}: AiWorldEditScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createAiWorldEditStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('aiWorldEditPage.title')}</Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !form.name) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('aiWorldEditPage.subtitle')}</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Globe2 size={18} color={tk.brandAccent.deep} />
            <Text style={styles.cardTitle}>{t('aiWorldEditPage.formTitle')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldEditPage.nameLabel')}</Text>
            <TextField
              colorScheme={colorScheme}
              value={form.name}
              onChangeText={(v) => onChange({ name: v })}
              placeholder={t('aiWorldEditPage.namePlaceholder')}
              maxLength={200}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldEditPage.descLabel')}</Text>
            <TextField
              colorScheme={colorScheme}
              value={form.description}
              onChangeText={(v) => onChange({ description: v })}
              placeholder={t('aiWorldEditPage.descPlaceholder')}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldEditPage.categoryLabel')}</Text>
            {categoriesLoading ? (
              <ActivityIndicator
                style={styles.categoriesLoading}
                size="small"
                color={tk.text.tertiary}
              />
            ) : categoriesError ? (
              <View style={styles.inlineError}>
                <Text style={styles.errorText}>{categoriesError}</Text>
                <TouchableOpacity onPress={onRetryCategories} activeOpacity={0.7}>
                  <Text style={styles.retryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.chipRow}>
                <Chip
                  label={t('aiWorldEditPage.noCategory')}
                  selected={form.categoryId === ''}
                  styles={styles}
                  onPress={() => onChange({ categoryId: '' })}
                />
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={form.categoryId === category.id}
                    styles={styles}
                    onPress={() => onChange({ categoryId: category.id })}
                  />
                ))}
                {categories.length === 0 ? (
                  <Text style={styles.muted}>{t('aiWorldEditPage.categoryEmpty')}</Text>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('aiWorldEditPage.coverLabel')}</Text>
            <TextField
              colorScheme={colorScheme}
              value={form.coverImage}
              onChangeText={(v) => onChange({ coverImage: v })}
              placeholder={t('aiWorldEditPage.coverPlaceholder')}
              autoCapitalize="none"
              maxLength={500}
              style={styles.input}
            />
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.disabled]}
            onPress={onSubmit}
            disabled={saving}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
            ) : (
              <Save size={16} color={tk.brand.ctaForeground} />
            )}
            <Text style={styles.primaryBtnText}>
              {saving ? t('aiWorldEditPage.submitting') : t('aiWorldEditPage.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

type AiWorldEditStyles = ReturnType<typeof createAiWorldEditStyles>

function Chip({
  label,
  selected,
  styles,
  onPress,
}: {
  label: string
  selected: boolean
  styles: AiWorldEditStyles
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected ? styles.chipSelected : null]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={selected ? styles.chipSelectedText : styles.chipText}>{label}</Text>
    </TouchableOpacity>
  )
}

function createAiWorldEditStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    scroll: { padding: 12, paddingBottom: 32, gap: 10 },
    subtitle: { fontSize: rnType.label.size, color: tk.text.tertiary },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    card: {
      gap: rnSpacing.md,
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    field: { gap: 5 },
    label: { fontSize: rnType.label.size, color: tk.text.secondary },
    input: {
      minHeight: 42,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      color: tk.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tk.surface.bg,
    },
    textarea: { minHeight: 120, lineHeight: 21 },
    categoriesLoading: { alignSelf: 'flex-start', paddingVertical: rnSpacing.xs },
    inlineError: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    errorText: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    retryText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    chipSelected: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipSelectedText: {
      fontSize: rnType.label.size,
      color: tk.brand.ctaForeground,
      fontWeight: '600',
    },
    primaryBtn: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    disabled: { opacity: 0.5 },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
