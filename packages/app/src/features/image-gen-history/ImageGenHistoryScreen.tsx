// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/** 生图任务状态(对齐 @ihui/api-client AigcTask['status']) */
export type ImageGenTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed'

/**
 * 历史/收藏统一网格渲染项(对应原 RN GridItem):
 * - status 仅历史任务有,收藏无状态
 * - coverUrl 已由端侧 resolveFileUrl 解析,空串渲染文字占位
 * - timeText 由端侧按当前 locale 预格式化(共享层不做 Intl/时区处理)
 */
export interface ImageGenHistoryGridItem {
  id: string
  coverUrl: string
  prompt: string
  status?: ImageGenTaskStatus
  timeText: string
}

/** 双 Tab 键:history=生成历史 / favorites=收藏 */
export type ImageGenHistoryTab = 'history' | 'favorites'

/**
 * ImageGenHistoryScreen 图像生成历史/收藏(共享层)props 契约。
 * 平台无关:API(getAigcTasks / fetchApi favorites)、分页、Alert、导航由端侧 wrapper 注入。
 */
export interface ImageGenHistoryScreenProps {
  t: TFunction
  /** 当前 Tab(wrapper 切换时清空数据并置 loading) */
  tab: ImageGenHistoryTab
  /** 当前 Tab 的网格数据(封面 URL 已 resolve,时间已格式化) */
  items: ImageGenHistoryGridItem[]
  /** 首屏/切 Tab 加载中(整屏 loading) */
  loading: boolean
  /** 下拉刷新中(RefreshControl) */
  refreshing: boolean
  /** 首屏加载失败文案(非空渲染错误态 + 重试) */
  error: string
  /** 切换 Tab */
  onTabChange: (tab: ImageGenHistoryTab) => void
  /** 下拉刷新 */
  onRefresh: () => void
  /** 上拉加载更多(分页守卫由 wrapper 内部处理) */
  onLoadMore: () => void
  /** 错误态重试 */
  onRetry: () => void
  /** 返回 */
  onBack: () => void
  /** 跳转生图创建页 */
  onCreate: () => void
  colorScheme?: 'light' | 'dark'
}

/** 状态 → i18n key(原屏 STATUS_KEY 沿用) */
const STATUS_KEY: Record<ImageGenTaskStatus, string> = {
  pending: 'imageGen.statusPending',
  running: 'imageGen.statusRunning',
  succeeded: 'imageGen.statusSucceeded',
  failed: 'imageGen.statusFailed',
}

/**
 * ImageGenHistoryScreen 图像生成历史/收藏(共享层)
 *
 * 2026-09-15 承接 mobile-rn ImageGenHistoryScreen 1:1 迁移:
 * - 结构:顶部导航行(返回/标题/生成)→ 历史/收藏双 Tab chips → 双列网格 FlatList
 *   (1:1 封面 + 状态角标 + prompt 两行 + 时间;无封面时文字占位)
 * - 平台无关:API、分页守卫、URL resolve、时间格式化、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex)
 * - i18n:沿用 imageGen.* / common.*(mobile-rn i18n 既有 key)
 */
export function ImageGenHistoryScreen({
  t,
  tab,
  items,
  loading,
  refreshing,
  error,
  onTabChange,
  onRefresh,
  onLoadMore,
  onRetry,
  onBack,
  onCreate,
  colorScheme = 'light',
}: ImageGenHistoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const tabs: Array<{ key: ImageGenHistoryTab; label: string }> = [
    { key: 'history', label: t('imageGen.tabHistory') },
    { key: 'favorites', label: t('imageGen.tabFavorites') },
  ]

  const renderItem = ({ item }: { item: ImageGenHistoryGridItem }) => (
    <View style={styles.card}>
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.coverFallback}>
          <Text style={styles.coverFallbackText} numberOfLines={4}>
            {item.prompt || t('imageGen.promptFallback')}
          </Text>
        </View>
      )}
      {item.status ? (
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{t(STATUS_KEY[item.status])}</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <Text style={styles.prompt} numberOfLines={2}>
          {item.prompt || t('imageGen.promptFallback')}
        </Text>
        <Text style={styles.time}>{item.timeText}</Text>
      </View>
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航行:返回 / 标题 / 生成入口(跳转由 wrapper 的 onCreate 决定) */}
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('imageGen.title')}</Text>
        <TouchableOpacity onPress={onCreate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.createText}>{t('imageGen.create')}</Text>
        </TouchableOpacity>
      </View>

      {/* 历史/收藏双 Tab */}
      <View style={styles.tabRow}>
        {tabs.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => onTabChange(item.key)}
            style={[styles.tabChip, tab === item.key ? styles.tabChipActive : null]}
          >
            <Text style={tab === item.key ? styles.tabTextActive : styles.tabText}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<ImageGenHistoryGridItem>
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.3}
          onEndReached={onLoadMore}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'history' ? t('imageGen.historyEmpty') : t('imageGen.favoritesEmpty')}
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </View>
  )
}

/**
 * 样式:对齐原 RN nativewind 布局(px-4/pt-3/pb-2/gap-2/mb-3/rounded-lg/text-xs 等),
 * 全部颜色走 AppThemeTokens 语义 token,零 hex(状态角标半透明底用 overlay.modal)。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    createText: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.brandAccent.deep,
    },
    /* 双 Tab chips */
    tabRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    tabChip: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    tabChipActive: {
      backgroundColor: tk.surface.muted,
    },
    tabText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    tabTextActive: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.text.primary,
    },
    /* 错误态 */
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorText: {
      marginBottom: 12,
      fontSize: 14,
      textAlign: 'center',
      color: tk.text.secondary,
    },
    retryBtn: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: tk.surface.muted,
    },
    retryText: {
      fontSize: 14,
      color: tk.text.primary,
    },
    /* 双列网格 */
    listContent: {
      padding: 16,
    },
    row: {
      gap: 12,
    },
    card: {
      flex: 1,
      marginBottom: 12,
      overflow: 'hidden',
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cover: {
      width: '100%',
      aspectRatio: 1,
    } satisfies ImageStyle,
    coverFallback: {
      width: '100%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      backgroundColor: tk.surface.muted,
    } satisfies ViewStyle,
    coverFallbackText: {
      fontSize: 12,
      textAlign: 'center',
      color: tk.text.tertiary,
    },
    statusBadge: {
      position: 'absolute',
      left: 8,
      top: 8,
      borderRadius: rnRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: tk.overlay.modal,
    },
    statusBadgeText: {
      fontSize: 10,
      color: tk.surface.light,
    },
    cardBody: {
      padding: 8,
    },
    prompt: {
      fontSize: 12,
      fontWeight: '500',
      color: tk.text.primary,
    },
    time: {
      marginTop: 4,
      fontSize: 10,
      color: tk.text.tertiary,
    },
    /* 空态 */
    empty: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
  } satisfies Record<string, ViewStyle | TextStyle | ImageStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
