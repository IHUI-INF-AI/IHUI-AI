import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getFans, getFollowing } from '@ihui/api-client'
import { FollowScreen as SharedFollowScreen } from '@ihui/rn-app'
import type { FollowTab, FollowUserItem } from '@ihui/types'
import { unfollowUser } from '../api/social'
import { usePaginatedList } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

export function FollowScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<FollowTab>('following')

  const fetcher = useCallback(
    async (query: { page: number; pageSize: number }) => {
      const apiFn = tab === 'following' ? getFollowing : getFans
      const res = await apiFn(query)
      if (res.success) {
        return { success: true as const, data: res.data }
      }
      return { success: false as const, error: res.error || t('follow.loadFailed') }
    },
    [tab, t],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FollowUserItem>(fetcher, PAGE_SIZE)

  const onSelectTab = (next: FollowTab) => {
    if (next === tab) return
    setTab(next)
    setTimeout(refresh, 0)
  }

  // 取关确认弹窗:uni.showModal → RN Alert(取消/取消关注·destructive)
  const onUnfollow = (item: FollowUserItem) => {
    Alert.alert(t('follow.unfollowTitle'), `${item.nickname || item.username}?`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('follow.unfollow'),
        style: 'destructive',
        onPress: async () => {
          const res = await unfollowUser(item.id)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(t('common.failed'), res.error || t('follow.unfollowFailed'))
          }
        },
      },
    ])
  }

  return (
    <SharedFollowScreen
      t={t}
      items={items}
      activeTab={tab}
      onSelectTab={onSelectTab}
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
