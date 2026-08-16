import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getFollowing, type FollowUser } from '@ihui/api-client'
import { FollowingScreen as SharedFollowingScreen, type FollowingItem } from '@ihui/rn-app'
import { unfollowUser } from '../api/social'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList, type Fetcher } from '../hooks'
import { formatShortDateWithYear } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/**
 * 对齐说明:Uniapp 历史项目无独立关注列表页(仅 developer.vue 详情有关注按钮),
 * 用词对齐 Uniapp user.public 统计文案:statsFollowing=关注 / unfollow=取消关注。
 * mobile-rn/shared zh-CN 暂无 following.* key(translate 缺 key 返回 key 本身),
 * key 就绪后此覆盖可删。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'following.title': '我的关注',
  'following.empty': '暂无关注',
  'following.loadFailed': '加载失败',
  'following.unfollowTitle': '取消关注',
  'following.unfollow': '取消关注',
}

export function FollowingScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const fetcher = useCallback<Fetcher<FollowingItem>>(
    async (query) => {
      const res = await getFollowing(query)
      if (!res.success) return { success: false as const, error: uniappT('following.loadFailed') }
      const list: FollowingItem[] = (res.data?.list ?? []).map((u: FollowUser) => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        bio: u.bio ?? undefined,
        followedAt: formatShortDateWithYear(u.followedAt),
      }))
      return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
    },
    [uniappT],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FollowingItem>(fetcher, PAGE_SIZE)

  const onUnfollow = (item: FollowingItem) => {
    Alert.alert(
      uniappT('following.unfollowTitle') || uniappT('common.confirm'),
      `${item.nickname || item.username}?`,
      [
        { text: uniappT('common.cancel'), style: 'cancel' },
        {
          text: uniappT('following.unfollow'),
          style: 'destructive',
          onPress: async () => {
            const res = await unfollowUser(item.id)
            if (res.success) {
              removeItem((i) => i.id === item.id)
            } else {
              Alert.alert(uniappT('common.failed'), res.error || uniappT('following.loadFailed'))
            }
          },
        },
      ],
    )
  }

  return (
    <SharedFollowingScreen
      t={uniappT}
      items={items}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      error={error}
      onRefresh={refresh}
      onLoadMore={loadMore}
      onUnfollow={onUnfollow}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
