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

/**
 * 对齐说明:Uniapp 历史项目无独立关注/粉丝列表页(仅 developer.vue 详情有关注按钮),
 * 用词对齐 Uniapp user.public 统计文案:statsFollowing=关注 / statsFollowers=粉丝 / unfollow=取消关注。
 * mobile-rn/shared zh-CN 暂无 follow.* key(translate 缺 key 返回 key 本身),
 * key 就绪后此覆盖可删。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'follow.title': '关注与粉丝',
  'follow.following': '关注',
  'follow.fans': '粉丝',
  'follow.empty': '暂无关注',
  'follow.loadFailed': '加载失败',
  'follow.unfollowTitle': '取消关注',
  'follow.unfollow': '取消关注',
  'follow.unfollowFailed': '取消关注失败',
}

export function FollowScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<FollowTab>('following')

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const fetcher = useCallback(
    async (query: { page: number; pageSize: number }) => {
      const apiFn = tab === 'following' ? getFollowing : getFans
      const res = await apiFn(query)
      if (res.success) {
        return { success: true as const, data: res.data }
      }
      return { success: false as const, error: res.error || uniappT('follow.loadFailed') }
    },
    [tab, uniappT],
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
    Alert.alert(uniappT('follow.unfollowTitle'), `${item.nickname || item.username}?`, [
      { text: uniappT('common.cancel'), style: 'cancel' },
      {
        text: uniappT('follow.unfollow'),
        style: 'destructive',
        onPress: async () => {
          const res = await unfollowUser(item.id)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(uniappT('common.failed'), res.error || uniappT('follow.unfollowFailed'))
          }
        },
      },
    ])
  }

  return (
    <SharedFollowScreen
      t={uniappT}
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
