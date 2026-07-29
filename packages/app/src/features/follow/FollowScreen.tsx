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
import type { FollowScreenProps, FollowTab, FollowUserItem } from '@ihui/types'

/** 关注/粉丝列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { FollowScreenProps, FollowTab, FollowUserItem }

/** 取昵称首字符(用作头像占位文字) */
function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

const TABS: FollowTab[] = ['following', 'fans']

/**
 * 关注/粉丝列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ tabs(following/fans)
 * + 用户卡片列表(Avatar[Image 或首字母占位] + nickname/username + bio + followedAt
 * + 取关按钮[仅 following tab 显示])+ 下拉刷新 + 上拉加载更多。
 * 平台特定(导航 / API 调用 / Alert 确认)由 wrapper 通过 props 注入。
 */
export function FollowScreen({
  t,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onLoadMore,
  onUnfollow,
  onBack,
  colorScheme = 'light',
}: FollowScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const tabLabel = (tab: FollowTab) => {
    return tab === 'following' ? t('follow.following') : t('follow.fans')
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('follow.title')}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onSelectTab(tab)}
              style={[styles.tab, active && styles.tabActive]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabLabel(tab)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList<FollowUserItem>
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
              <Text style={styles.emptyText}>{t('follow.empty')}</Text>
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
              {activeTab === 'following' ? (
                <TouchableOpacity
                  onPress={() => onUnfollow(item)}
                  style={styles.unfollowBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={styles.unfollowBtnText}>{t('follow.unfollow')}</Text>
                </TouchableOpacity>
              ) : null}
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
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: tk.success.DEFAULT },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 12 },
    center: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    footer: { alignItems: 'center', paddingVertical: 16 },
    footerText: { fontSize: 11, color: tk.text.secondary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
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
    cardName: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardBio: { marginTop: 2, fontSize: 11, color: tk.text.secondary },
    cardMeta: { marginTop: 2, fontSize: 11, color: tk.text.tertiary },
    unfollowBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    unfollowBtnText: { fontSize: 12, color: tk.text.primary },
  })
}
