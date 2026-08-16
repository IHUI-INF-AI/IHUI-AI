import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { FollowingItem, FollowingScreenProps } from '../../types'

/** 关注列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { FollowingItem, FollowingScreenProps }

/** 取昵称首字符(用作头像占位文字) */
function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

/**
 * 关注列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 关注用户卡片列表(头像 + 昵称 + bio + 关注时间 + 取消关注按钮)
 * + 下拉刷新 + 上拉加载更多。
 * 平台特定(导航 / API 调用 / Alert 确认 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function FollowingScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onLoadMore,
  onUnfollow,
  onBack,
  colorScheme = 'light',
}: FollowingScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('following.title')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList<FollowingItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('following.empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const displayName = item.nickname || item.username
          return (
            <View style={styles.card}>
              <View style={styles.avatar}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{initials(displayName)}</Text>
                )}
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {displayName}
                </Text>
                {item.bio ? (
                  <Text style={styles.cardBio} numberOfLines={1}>
                    {item.bio}
                  </Text>
                ) : null}
                <Text style={styles.cardMeta}>{item.followedAt}</Text>
              </View>
              <TouchableOpacity
                onPress={() => onUnfollow(item)}
                style={styles.unfollowBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.unfollowBtnText}>{t('following.unfollow')}</Text>
              </TouchableOpacity>
            </View>
          )
        }}
      />
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
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    errorBar: { paddingHorizontal: 10, paddingVertical: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    listBody: { padding: 10, paddingBottom: 32 },
    separator: { height: 12 },
    center: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    footer: { alignItems: 'center', paddingVertical: 16 },
    footerText: { fontSize: 11, color: tk.text.secondary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%', borderRadius: 24 },
    avatarInitial: { fontSize: 18, fontWeight: '600', color: tk.text.secondary },
    cardInfo: { flex: 1, marginLeft: 12 },
    cardName: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    cardBio: { marginTop: 8, fontSize: 11, color: tk.text.secondary },
    cardMeta: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    unfollowBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    unfollowBtnText: { fontSize: 14, color: tk.text.primary },
  })
}
