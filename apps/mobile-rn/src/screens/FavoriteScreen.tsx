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

export function FavoriteScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<FavoriteFilterTab>('all')

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
      return { success: false as const, error: res.error || t('favorite.loadFailed') }
    },
    [tab, t],
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
    Alert.alert(t('favorite.deleteTitle'), item.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const res = await deleteFavorite(item.targetType, item.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(t('common.failed'), res.error || t('favorite.deleteFailed'))
          }
        },
      },
    ])
  }

  return (
    <SharedFavoriteScreen
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
      onDelete={onDelete}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
