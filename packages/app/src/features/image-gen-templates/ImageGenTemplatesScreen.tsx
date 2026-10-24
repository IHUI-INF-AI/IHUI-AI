// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Sparkles, X } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * ImageGenTemplatesScreen — 跨端共享「提示词模板屏」(门 39 六屏共享化第二批)。
 *
 * 为什么进共享层:守门 39 的屏级共享维要求 RN 有 `@ihui/rn-app` import 的同时
 * `packages/app` 有同名共享屏 —— 本文件是
 * `apps/mobile-rn/src/screens/ImageGenTemplatesScreen.tsx` 的 UI 下沉(照
 * `features/points/PointsScreen.tsx` 的 props 注入式,wrapper 只留 API 调用、导航、
 * 剪贴板、i18n 与主题注入)。**不准**靠"补一条 import"或塞白名单消门 39 的红。
 *
 * 端点事实(取自端内原实现头注):GET /api/image-gen/templates 只回 list,
 * 行上假设的 title/categoryId/previewUrl 都不存在 ⇒ 分类从 list 自身 category 派生,
 * 标题取 name,不渲染预览图。动线 = 预览 + 复制 + 去生成(生成页不吃 params)。
 */
export interface ImageTemplateItem {
  id: string
  name: string
  description: string | null
  prompt: string | null
  category: string | null
  /** 平台格式化好的日期文本(非法日期传 '—') */
  createdAtText: string
}

export interface ImageGenTemplatesScreenProps {
  t: TFunction
  /** 已按 activeCategory 过滤后的可见项 */
  items: ImageTemplateItem[]
  categories: string[]
  /** 'all' 或分类名 */
  activeCategory: string
  loading: boolean
  refreshing: boolean
  /** 非空即渲染错误块 */
  errorText: string
  preview: ImageTemplateItem | null
  /** 复制结果提示;空串 = 不显示 */
  notice: string
  onCategoryChange: (category: string) => void
  onRefresh: () => void
  onRetry: () => void
  onOpenPreview: (item: ImageTemplateItem) => void
  onClosePreview: () => void
  onCopy: (prompt: string) => void
  onCopyAndCreate: (item: ImageTemplateItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export function ImageGenTemplatesScreen({
  t,
  items,
  categories,
  activeCategory,
  loading,
  refreshing,
  errorText,
  preview,
  notice,
  onCategoryChange,
  onRefresh,
  onRetry,
  onOpenPreview,
  onClosePreview,
  onCopy,
  onCopyAndCreate,
  onBack,
  colorScheme = 'light',
}: ImageGenTemplatesScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const empty = !loading && !errorText && items.length === 0

  const renderChips = () => (
    <View style={styles.chips}>
      <TouchableOpacity
        onPress={() => onCategoryChange('all')}
        activeOpacity={0.7}
        style={[styles.chip, activeCategory === 'all' && styles.chipActive]}
        accessibilityRole="button"
        accessibilityLabel={t('imageGenTemplates.all')}
      >
        <Text style={[styles.chipText, activeCategory === 'all' && styles.chipActiveText]}>
          {t('imageGenTemplates.all')}
        </Text>
      </TouchableOpacity>
      {categories.map((c) => {
        const active = activeCategory === c
        return (
          <TouchableOpacity
            key={c}
            onPress={() => onCategoryChange(c)}
            activeOpacity={0.7}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={c}
          >
            <Text style={[styles.chipText, active && styles.chipActiveText]}>{c}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const renderCard = ({ item }: { item: ImageTemplateItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onOpenPreview(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.cardTitleRow}>
        <Sparkles size={16} color={tk.text.secondary} />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      {item.prompt ? (
        <Text style={styles.cardPrompt} numberOfLines={2}>
          {item.prompt}
        </Text>
      ) : null}
      <View style={styles.cardMeta}>
        <View style={styles.cardMetaLeft}>
          <Text style={styles.badge}>
            {item.category?.trim() || t('imageGenTemplates.uncategorized')}
          </Text>
          <Text style={styles.metaText}>{t('imageGenTemplates.use')}</Text>
        </View>
        <Text style={styles.metaText}>{item.createdAtText}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('imageGenTemplates.title')}</Text>
      </View>

      <FlatList
        data={errorText ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.text.tertiary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.subtitle}>{t('imageGenTemplates.subtitle')}</Text>
            {loading ? (
              <ScreenSkeleton variant="grid" count={4} colorScheme={colorScheme} />
            ) : errorText ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorText}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={onRetry}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('imageGenTemplates.retry')}
                >
                  <Text style={styles.retryText}>{t('imageGenTemplates.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              renderChips()
            )}
            {empty ? (
              <EmptyState title={t('imageGenTemplates.empty')} colorScheme={colorScheme} />
            ) : null}
          </View>
        }
      />

      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        onRequestClose={onClosePreview}
      >
        <Pressable style={styles.overlay} onPress={onClosePreview}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {preview?.name ?? t('imageGenTemplates.previewTitle')}
              </Text>
              <TouchableOpacity
                onPress={onClosePreview}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <X size={20} color={tk.text.secondary} />
              </TouchableOpacity>
            </View>
            {preview?.description ? (
              <Text style={styles.sheetDesc}>{preview.description}</Text>
            ) : null}
            <Text style={styles.sheetLabel}>{t('imageGenTemplates.contentLabel')}</Text>
            <ScrollView style={styles.sheetContentBox}>
              <Text selectable style={styles.sheetContent}>
                {preview?.prompt ?? ''}
              </Text>
            </ScrollView>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <TouchableOpacity
              style={[styles.button, !preview?.prompt && styles.buttonDisabled]}
              disabled={!preview?.prompt}
              onPress={() => {
                if (preview?.prompt) onCopy(preview.prompt)
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('imageGenTemplates.copy')}
            >
              <Text style={styles.buttonText}>{t('imageGenTemplates.copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                !preview?.prompt && styles.buttonDisabled,
              ]}
              disabled={!preview?.prompt}
              onPress={() => {
                if (preview) onCopyAndCreate(preview)
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('imageGenTemplates.goCreate')}
            >
              <Text style={styles.secondaryButtonText}>{t('imageGenTemplates.goCreate')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing.sm,
    },
    title: { flex: 1, fontSize: 17, fontWeight: '600', color: tk.text.primary },
    body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
    column: { gap: 10 },
    listHeader: { gap: 10, paddingBottom: 2 },
    subtitle: { fontSize: 13, color: tk.text.secondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    chipActive: { backgroundColor: tk.brand.cta },
    chipText: { fontSize: rnType.label.size, fontWeight: '500', color: tk.text.secondary },
    chipActiveText: { color: tk.brand.ctaForeground },
    errorBox: {
      paddingVertical: rnSpacing.lg,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.danger.DEFAULT,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    retryBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    retryText: { fontSize: 13, color: tk.text.primary },
    card: {
      flex: 1,
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { flex: 1, fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    cardDesc: { fontSize: rnType.label.size, lineHeight: 18, color: tk.text.secondary },
    cardPrompt: {
      fontSize: rnType.label.size,
      lineHeight: 18,
      fontFamily: 'monospace',
      color: tk.text.secondary,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 6,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.bg,
    },
    cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flexShrink: 1 },
    badge: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    metaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    overlay: {
      flex: 1,
      justifyContent: 'center',
      padding: rnSpacing.xl,
      backgroundColor: tk.overlay.modal,
    },
    sheet: {
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.lg,
      gap: 10,
      maxHeight: '80%',
    },
    sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    sheetTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    sheetDesc: { fontSize: rnType.label.size, lineHeight: 18, color: tk.text.secondary },
    sheetLabel: { fontSize: rnType.label.size, color: tk.text.tertiary },
    sheetContentBox: {
      padding: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.bg,
      maxHeight: 260,
    },
    sheetContent: { fontSize: 13, lineHeight: 20, color: tk.text.primary },
    notice: { fontSize: rnType.label.size, color: tk.text.secondary },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.brand.ctaForeground },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    secondaryButtonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
