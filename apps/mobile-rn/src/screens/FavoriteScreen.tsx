import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getFavorites } from '@ihui/api-client'
import { FavoriteScreen as SharedFavoriteScreen } from '@ihui/rn-app'
import type { FavoriteFilterTab, FavoriteItemRow } from '@ihui/types'
import { deleteFavorite } from '../api/social'
import { usePaginatedList } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/**
 * 对齐说明:Uniapp 历史项目无独立收藏列表页(收藏散落在各详情页内),
 * 文案参照 shared bookmarks/favorites 命名空间 + tab 类型(全部/课程/直播/文章)中文硬编码。
 * mobile-rn/shared zh-CN 暂无 favorite.* key(translate 缺 key 返回 key 本身),
 * key 就绪后此覆盖自动失效(UNIAPP_TEXT 优先级高于 t,后续可删)。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'favorite.title': '我的收藏',
  'favorite.tabAll': '全部',
  'favorite.tabCourse': '课程',
  'favorite.tabLive': '直播',
  'favorite.tabArticle': '文章',
  'favorite.empty': '暂无收藏',
  'favorite.loadFailed': '加载收藏失败',
  'favorite.deleteTitle': '删除收藏',
  'favorite.deleteFailed': '删除失败',
}

export function FavoriteScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<FavoriteFilterTab>('all')

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const fetcher = useCallback(
    async (query: { page: number; pageSize: number }) => {
      const apiQuery: { page: number; pageSize: number; targetType?: string } = {
        page: query.page,
        pageSize: query.pageSize,
      }
      if (tab !== 'all') apiQuery.targetType = tab
      const res = await getFavorites(apiQuery)
      if (res.success) {
        return { success: true as const, data: res.data }
      }
      return { success: false as const, error: res.error || uniappT('favorite.loadFailed') }
    },
    [tab, uniappT],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FavoriteItemRow>(fetcher, PAGE_SIZE)

  const onSelectTab = (next: FavoriteFilterTab) => {
    if (next === tab) return
    setTab(next)
    setTimeout(refresh, 0)
  }

  // 删除确认弹窗:uni.showModal → RN Alert(取消/删除·destructive)
  const onDelete = (item: FavoriteItemRow) => {
    Alert.alert(uniappT('favorite.deleteTitle'), item.title, [
      { text: uniappT('common.cancel'), style: 'cancel' },
      {
        text: uniappT('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const res = await deleteFavorite(item.targetType, item.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(uniappT('common.failed'), res.error || uniappT('favorite.deleteFailed'))
          }
        },
      },
    ])
  }

  return (
    <SharedFavoriteScreen
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
      onDelete={onDelete}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
