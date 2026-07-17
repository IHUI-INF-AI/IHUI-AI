import { useCallback } from 'react'
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { getSubscriptions, cancelSubscription, type SubscriptionItem } from '../api/social'
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

export function SubscriptionsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<SubscriptionItem>(
      useCallback(async (query) => getSubscriptions(query), []),
      PAGE_SIZE,
    )

  const onCancel = (item: SubscriptionItem) => {
    Alert.alert(t('subscriptions.cancelTitle') || t('common.confirm'), item.targetId, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('subscriptions.cancel'),
        style: 'destructive',
        onPress: async () => {
          const res = await cancelSubscription(item.targetType, item.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(t('common.failed'), res.error || t('subscriptions.loadFailed'))
          }
        },
      },
    ])
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
            {t('subscriptions.title')}
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
              <Text className="text-sm text-neutral-500">{t('subscriptions.empty')}</Text>
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
            <View className="h-10 w-10 items-center justify-center rounded-md bg-blue-100">
              <Text className="text-xs font-semibold text-blue-700">{item.targetType}</Text>
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-50"
                numberOfLines={1}
              >
                {item.targetId}
              </Text>
              <Text className="mt-0.5 text-xs text-neutral-500">{formatDate(item.createdAt)}</Text>
            </View>
            <Button onPress={() => onCancel(item)} variant="outline" size="sm">
              {t('subscriptions.cancel')}
            </Button>
          </Card>
        )}
      />
    </View>
  )
}
