import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  SubscriptionsScreen as SharedSubscriptionsScreen,
  type SubscriptionsItem,
} from '@ihui/rn-app'
import {
  cancelSubscription,
  getSubscriptions,
} from '../api/social'
import { usePaginatedList } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateWithYear } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/**
 * 对齐说明:Uniapp 历史项目无独立订阅列表页(vip_info introduce-popup 仅含「订阅」入口文案),
 * 文案取 miniapp-taro zh-CN subscriptions 命名空间标准值。
 * mobile-rn/shared zh-CN 暂无 subscriptions.* key(translate 缺 key 返回 key 本身),
 * key 就绪后此覆盖可删。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'subscriptions.title': '我的订阅',
  'subscriptions.empty': '暂无订阅',
  'subscriptions.cancel': '取消订阅',
  'subscriptions.cancelTitle': '取消订阅',
  'subscriptions.loadFailed': '加载失败',
}

export function SubscriptionsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<SubscriptionsItem>(
      useCallback(async (query) => {
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
        return { success: false as const, error: res.error || uniappT('subscriptions.loadFailed') }
      }, [uniappT]),
      PAGE_SIZE,
    )

  // 取消订阅确认弹窗:uni.showModal → RN Alert(取消/取消订阅·destructive)
  const onCancel = (item: SubscriptionsItem) => {
    Alert.alert(uniappT('subscriptions.cancelTitle'), item.targetId, [
      { text: uniappT('common.cancel'), style: 'cancel' },
      {
        text: uniappT('subscriptions.cancel'),
        style: 'destructive',
        onPress: async () => {
          const res = await cancelSubscription(item.targetType, item.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(uniappT('common.failed'), res.error || uniappT('subscriptions.loadFailed'))
          }
        },
      },
    ])
  }

  return (
    <SharedSubscriptionsScreen
      t={uniappT}
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
