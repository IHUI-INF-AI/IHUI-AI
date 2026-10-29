// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ArticleListItem, ArticleListScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

/** 文章列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { ArticleListItem, ArticleListScreenProps }

/** 骨架屏卡片数量(模拟首屏可见区域的文章卡片数) */
const SKELETON_COUNT = 5

/**
 * 文章列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 加载态(骨架屏)+ 错误态(重试)
 * + 文章卡片列表(title + author + views + publishedAt)
 * + 下拉刷新 + 空态(引导文字 + 刷新按钮)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 *
 * 2026-09-23 修复:
 * - P1:首次加载改为骨架屏(共享 ScreenSkeleton),保持 header 框架可见,不再全灰屏
 * - P2:空状态使用共享 EmptyState(引导文字 + 刷新按钮)
 * - P3:错误状态使用共享 ErrorState(错误文字 + 重试按钮),框架保持可见
 */
export function ArticleListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  onEndReached,
  loadingMore = false,
  colorScheme = 'light',
}: ArticleListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 首次加载(无数据时的 loading 态)→ 骨架屏 */
  const showSkeleton = loading && items.length === 0
  /** 错误态(无数据时的 error)→ 居中错误提示 + 重试 */
  const showError = !loading && error.length > 0 && items.length === 0

  return (
    <View style={styles.container}>
      {/* header 始终渲染 — 保持页面框架可见(修复 P1 全灰屏连导航消失) */}
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('articleList.title')}</Text>
      </View>

      {/* 内容区:根据状态条件渲染,header 框架始终可见 */}
      {showSkeleton ? (
        /* P1 修复:骨架屏替代纯文字"加载中...",模拟文章卡片占位 */
        <ScreenSkeleton variant="card" count={SKELETON_COUNT} colorScheme={colorScheme} />
      ) : showError ? (
        /* P3 修复:错误态居中显示图标 + 错误文字 + 重试按钮 */
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <FlatList<ArticleListItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={tk.brand.DEFAULT} />
                <Text style={styles.footerText}>{t('common.loading')}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            /* P2 修复:空状态添加引导文字 + 刷新按钮 */
            <EmptyState
              title={t('articleList.empty')}
              actionLabel={t('common.retry')}
              onAction={onRefresh}
              colorScheme={colorScheme}
            />
          }
          renderItem={({ item }) => (
            <PressableCard
              style={styles.card}
              onPress={() => onPressItem(item)}
              colorScheme={colorScheme}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.author}>{item.author}</Text>
                <Text style={styles.meta}>
                  {t('articleList.views', { count: item.views })} · {item.publishedAt}
                </Text>
              </View>
            </PressableCard>
          )}
        />
      )}
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
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    listBody: { padding: 10 },
    separator: { height: 12 },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: rnSpacing.sm,
    },
    author: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
    },
    footerText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
