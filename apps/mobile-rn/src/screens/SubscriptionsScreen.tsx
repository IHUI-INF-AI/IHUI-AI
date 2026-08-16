import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  SubscriptionsScreen as SharedSubscriptionsScreen,
  type SubscriptionsItem,
} from '@ihui/rn-app'
import { cancelSubscription, getSubscriptions } from '../api/social'
import { usePaginatedList } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateWithYear } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

export function SubscriptionsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<SubscriptionsItem>(
      useCallback(
        async (query) => {
          const res = await getSubscriptions(query)
          if (res.success && res.data) {
            return {
              success: true as const,
              data: {
                list: res.data.list.map((raw) => ({
                  id: raw.id,
                  targetType: raw.targetType,
                  targetId: raw.targetId,
                  createdAt: formatShortDateWithYear(raw.createdAt),
                })) as SubscriptionsItem[],
                total: res.data.total,
                page: res.data.page,
                pageSize: res.data.pageSize,
              },
            }
          }
          return {
            success: false as const,
            error: res.error || t('subscriptions.loadFailed'),
          }
        },
        [t],
      ),
      PAGE_SIZE,
    )

  // 取消订阅确认弹窗:uni.showModal → RN Alert(取消/取消订阅·destructive)
  const onCancel = (item: SubscriptionsItem) => {
    Alert.alert(t('subscriptions.cancelTitle'), item.targetId, [
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
    <SharedSubscriptionsScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      error={error}
      onRefresh={refresh}
      onLoadMore={loadMore}
      onCancel={onCancel}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
