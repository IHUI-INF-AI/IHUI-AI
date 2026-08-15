import { useCallback, useMemo } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getFavorites, type FavoriteItem } from '@ihui/api-client'
import { FavoritesScreen as SharedFavoritesScreen, type FavoritesItem } from '@ihui/rn-app'
import { deleteFavorite } from '../api/social'
import { usePaginatedList } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateWithYear } from '../utils/date-utils'

const PAGE_SIZE = 20

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// 对齐说明:Uniapp 历史项目无独立收藏列表页;favorites.* 文案 shared zh-CN 已齐,
// 本页仅补 colorScheme 主题注入(对齐其余 9 个 wrapper 的深浅色处理)
export function FavoritesScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FavoriteItem>(
      useCallback(async (query) => getFavorites(query), []),
      PAGE_SIZE,
    )

  const sharedItems = useMemo<FavoritesItem[]>(
    () =>
      items.map((f) => ({
        id: f.id,
        title: f.title,
        cover: f.cover,
        targetType: f.targetType,
        createdAt: formatShortDateWithYear(f.createdAt),
      })),
    [items],
  )

  const onDelete = (item: FavoritesItem) => {
    Alert.alert(t('favorites.deleteTitle') || t('common.confirm'), item.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const original = items.find((i) => i.id === item.id)
          if (!original) return
          const res = await deleteFavorite(original.targetType, original.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(t('common.failed'), res.error || t('favorites.loadFailed'))
          }
        },
      },
    ])
  }

  return (
    <SharedFavoritesScreen
      t={t}
      items={sharedItems}
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
