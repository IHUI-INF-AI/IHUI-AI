// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ImageOff, Images } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/**
 * ImageGenGalleryScreen — 跨端共享「公开图库屏」(门 39 六屏共享化第一批)。
 *
 * 为什么进共享层:守门 39 的屏级共享维(V2)要求 RN 有 `@ihui/rn-app` import 的同时
 * `packages/app` 有同名共享屏 —— 本文件是 `apps/mobile-rn/src/screens/ImageGenGalleryScreen.tsx`
 * 的 UI 下沉(照 `features/image-gen-history/ImageGenHistoryScreen.tsx` / PaymentScreen 的
 * props 注入式,wrapper 只留 API 分页 / 图片地址解析 / 预览弹层 / i18n 与主题注入)。
 *
 * 平台无关边界:
 *  - 数据:`content` 原文照搬(提示词),`imageUrl` 由平台判定「content 是否就是图片地址」
 *    后注入 —— 共享层不依赖 `@ihui/api-client` 的 `resolveFileUrl`;
 *  - 时间和图片地址都预先算好注入,共享层零 IO;
 *  - 全屏预览(ImagePreviewModal)与"这条不是图片"的提示属平台能力,只发回调。
 *
 * 业务判据(随 UI 一起下沉,两端共用一枚):只有 `imageUrl` 非空的条目才可预览 —— 提示词
 * 一律不当图片喂给 Image。
 */
export interface GalleryImageItem {
  /** 行 id(作为列表 key) */
  id: string
  /** ai_gc_content.content 原文(提示词;仅当它本身是图片地址时 `imageUrl` 才非空) */
  content: string | null
  /** 平台解析好的图片地址;null = 非图片内容(渲染占位,不伪造 URL) */
  imageUrl: string | null
  /** 平台格式化好的创建日期文本 */
  createdAtText: string
}

export interface ImageGenGalleryScreenProps {
  t: TFunction
  items: GalleryImageItem[]
  total: number
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  /** 错误态文案(非空则渲染错误态 + 重试钮) */
  error: string
  onRefresh: () => void
  onRetry: () => void
  onLoadMore: () => void
  /** 打开可预览图:urls 为当前可预览集合,index 为被点条目在其中的位置 */
  onPreview: (urls: string[], index: number) => void
  /** 点到的条目不是图片(平台给如实提示,不静默) */
  onMissingImage: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 可预览图集合:只含 `imageUrl` 非空的条目,顺序与列表一致(索引映射的唯一依据)。 */
export function previewableGalleryImages(
  items: GalleryImageItem[],
): Array<{ id: string; url: string }> {
  return items
    .filter((item): item is GalleryImageItem & { imageUrl: string } => item.imageUrl !== null)
    .map((item) => ({ id: item.id, url: item.imageUrl }))
}

export function ImageGenGalleryScreen({
  t,
  items,
  total,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onRetry,
  onLoadMore,
  onPreview,
  onMissingImage,
  onBack,
  colorScheme = 'light',
}: ImageGenGalleryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const openItem = (item: GalleryImageItem) => {
    if (!item.imageUrl) {
      onMissingImage()
      return
    }
    const previewables = previewableGalleryImages(items)
    const urls = previewables.map((x) => x.url)
    const idx = previewables.findIndex((x) => x.id === item.id)
    onPreview(urls, idx >= 0 ? idx : 0)
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.subtitle}>{t('imageGenGallery.subtitle')}</Text>
      {loading ? (
        <ActivityIndicator style={styles.loading} color={tk.text.tertiary} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={onRetry}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('imageGenGallery.retry')}
          >
            <Text style={styles.retryText}>{t('imageGenGallery.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Images size={32} color={tk.text.tertiary} />
          <Text style={styles.emptyText}>{t('imageGenGallery.empty')}</Text>
        </View>
      ) : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.navHeader}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('imageGenGallery.title')}</Text>
      </View>

      <FlatList
        data={error ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openItem(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              item.imageUrl ? t('imageGenGallery.title') : t('imageGenGallery.noImage')
            }
          >
            <View style={styles.imageBox}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <ImageOff size={24} color={tk.text.tertiary} />
                  <Text style={styles.placeholderText}>{t('imageGenGallery.noImage')}</Text>
                </View>
              )}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.prompt} numberOfLines={2}>
                {item.content ?? ''}
              </Text>
              <Text style={styles.metaText}>{item.createdAtText}</Text>
            </View>
          </TouchableOpacity>
        )}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.body}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.text.tertiary}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          error ? null : loadingMore ? (
            <ActivityIndicator style={styles.footerLoading} color={tk.text.tertiary} />
          ) : items.length > 0 && items.length >= total ? (
            <Text style={styles.footerText}>{t('imageGenGallery.noMore')}</Text>
          ) : null
        }
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    navHeader: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
    column: { gap: 10 },
    header: { gap: 10, paddingBottom: 2 },
    subtitle: { fontSize: 13, color: tk.text.secondary },
    loading: { paddingVertical: rnSpacing['2xl'] },
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
    emptyBox: { alignItems: 'center', paddingVertical: rnSpacing['4xl'], gap: rnSpacing.sm },
    emptyText: { fontSize: 13, color: tk.text.secondary },
    card: {
      flex: 1,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      overflow: 'hidden',
    },
    imageBox: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center', gap: 6, paddingHorizontal: rnSpacing.sm },
    placeholderText: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      textAlign: 'center',
    },
    cardBody: { padding: rnSpacing.lg, gap: rnSpacing.xs },
    prompt: { fontSize: rnType.label.size, lineHeight: 17, color: tk.text.primary },
    metaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    footerLoading: { paddingVertical: rnSpacing.lg },
    footerText: {
      paddingVertical: rnSpacing.lg,
      textAlign: 'center',
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
