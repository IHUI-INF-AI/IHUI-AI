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

export function FollowingScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const fetcher = useCallback<Fetcher<FollowingItem>>(async (query) => {
    const res = await getFollowing(query)
    if (!res.success) return { success: false as const, error: t('following.loadFailed') }
    const list: FollowingItem[] = (res.data?.list ?? []).map((u: FollowUser) => ({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      avatar: u.avatar,
      bio: u.bio ?? undefined,
      followedAt: formatShortDateWithYear(u.followedAt),
    }))
    return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
  }, [t])

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FollowingItem>(fetcher, PAGE_SIZE)

  const onUnfollow = (item: FollowingItem) => {
    Alert.alert(
      t('following.unfollowTitle') || t('common.confirm'),
      `${item.nickname || item.username}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('following.unfollow'),
          style: 'destructive',
          onPress: async () => {
            const res = await unfollowUser(item.id)
            if (res.success) {
              removeItem((i) => i.id === item.id)
            } else {
              Alert.alert(t('common.failed'), res.error || t('following.loadFailed'))
            }
          },
        },
      ],
    )
  }

  return (
    <SharedFollowingScreen
      t={t}
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
