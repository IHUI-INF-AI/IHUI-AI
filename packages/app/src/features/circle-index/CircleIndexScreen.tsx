// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MessageSquare, Plus, Users } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CircleListItem, CircleListScreenProps } from '../../types'

import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 圈子广场/Props 类型 re-export(单一来源 @ihui/types) */
export type { CircleListItem, CircleListScreenProps }

/**
 * 圈子广场共享屏 — props 注入式跨端组件。
 *
 * 业务对象与 web /circles 严格同口径:列表是 **圈子(group)** 卡,不是帖子卡;
 * 数据源 /api/circles 的 name/description/coverImage/memberCount/postCount。
 * 平台特定(取数 / 导航 / 建帖)全部由宿主注入,屏内不碰任何平台 API。
 */
export function CircleIndexScreen({
  t,
  title,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onCreatePost,
  onBack,
  colorScheme = 'light',
  hideHeader = false,
  onEndReached,
  loadingMore = false,
  noMore = false,
  contentBottomPadding = rnSpacing['3xl'],
}: CircleListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const showSkeleton = loading && items.length === 0
  const showError = !loading && error.length > 0 && items.length === 0

  const renderItem = ({ item }: { item: CircleListItem }) => (
    <Pressable
      onPress={() => onPressItem(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      {({ pressed }) => (
        <View style={[styles.card, pressed ? styles.cardPressed : null]}>
          <View style={styles.cover}>
            {item.coverImage ? (
              <Image source={{ uri: item.coverImage }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverFallback}>
                <Users size={28} color={tk.brand.DEFAULT} />
              </View>
            )}
          </View>
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.isJoined ? (
                <View style={styles.joinedBadge}>
                  <Text style={styles.joinedText}>{t('circle.index.followed')}</Text>
                </View>
              ) : null}
            </View>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Users size={13} color={tk.text.secondary} />
                <Text style={styles.statText}>
                  {item.memberCount} {t('circleDetail.members')}
                </Text>
              </View>
              <View style={styles.stat}>
                <MessageSquare size={13} color={tk.text.secondary} />
                <Text style={styles.statText}>
                  {item.postCount} {t('circleDetail.posts')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  )

  return (
    <View style={styles.container}>
      {hideHeader ? null : (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
      {showSkeleton ? (
        <ScreenSkeleton variant="grid" count={6} colorScheme={colorScheme} />
      ) : showError ? (
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('circle.index.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={[styles.listContent, { paddingBottom: contentBottomPadding }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Users size={36} color={tk.text.secondary} />}
              title={t('circle.empty')}
              actionLabel={t('circle.index.goPublish')}
              onAction={onCreatePost}
              colorScheme={colorScheme}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={tk.text.secondary} />
                <Text style={styles.footerText}>{t('circle.index.loading')}</Text>
              </View>
            ) : noMore && items.length > 0 ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('common.noMore')}</Text>
              </View>
            ) : null
          }
        />
      )}
      <Pressable
        onPress={onCreatePost}
        accessibilityRole="button"
        accessibilityLabel={t('circle.index.goPublish')}
        style={({ pressed }) => [styles.fab, pressed ? styles.fabPressed : null]}
      >
        <Plus size={24} color={tk.surface.light} />
      </Pressable>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    listContent: {
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing.sm,
      flexGrow: 1,
    },
    column: {
      gap: rnSpacing.sm,
    },
    card: {
      flex: 1,
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
    },
    cardPressed: {
      opacity: 0.86,
    },
    cover: {
      height: rnSpacing['4xl'],
      backgroundColor: tk.surface.light,
    },
    coverImage: {
      width: '100%',
      height: '100%',
    },
    coverFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: {
      padding: rnSpacing.sm,
      gap: rnSpacing.xs,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    name: {
      flex: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    joinedBadge: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.xs,
      backgroundColor: tk.surface.light,
    },
    joinedText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    description: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    statText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.lg,
    },
    footerText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    fab: {
      position: 'absolute',
      right: rnSpacing.lg,
      bottom: rnSpacing['2xl'],
      width: rnSpacing['3xl'],
      height: rnSpacing['3xl'],
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabPressed: {
      opacity: 0.85,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
