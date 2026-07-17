import { useCallback } from 'react'
import { Alert, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { getFollowing, type FollowUser } from '@ihui/api-client'
import { unfollowUser } from '../api/social'
import { usePaginatedList } from '../hooks/use-paginated-list'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

const PAGE_SIZE = 20

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function Avatar({ url, nickname }: { url: string | null; nickname: string }) {
  if (url) {
    return <Image source={{ uri: url }} className="h-12 w-12 rounded-full bg-neutral-100" />
  }
  return (
    <View className="h-12 w-12 items-center justify-center rounded-xl bg-neutral-200">
      <Text className="text-base font-semibold text-neutral-600">
        {(nickname || '?').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  )
}

export function FollowingScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FollowUser>(
      useCallback(async (query) => getFollowing(query), []),
      PAGE_SIZE,
    )

  const onUnfollow = (item: FollowUser) => {
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
    <View className="flex-1 bg-white dark:bg-black">
      <View className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Text className="text-base text-neutral-700 dark:text-neutral-300">
              {t('common.back')}
            </Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {t('following.title')}
          </Text>
        </View>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">{t('common.loading')}</Text>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">{t('following.empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-4">
              <Text className="text-xs text-neutral-500">{t('common.loading')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card className="flex-row items-center">
            <Avatar url={item.avatar} nickname={item.nickname || item.username} />
            <View className="ml-3 flex-1">
              <Text
                className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
                numberOfLines={1}
              >
                {item.nickname || item.username}
              </Text>
              {item.bio ? (
                <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
                  {item.bio}
                </Text>
              ) : null}
              <Text className="mt-0.5 text-xs text-neutral-400">{formatDate(item.followedAt)}</Text>
            </View>
            <Button onPress={() => onUnfollow(item)} variant="outline" size="sm">
              {t('following.unfollow')}
            </Button>
          </Card>
        )}
      />
    </View>
  )
}
