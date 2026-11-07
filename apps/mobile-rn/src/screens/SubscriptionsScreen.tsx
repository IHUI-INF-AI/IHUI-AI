// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  SubscriptionsScreen as SharedSubscriptionsScreen,
  type SubscriptionsItem,
} from '@ihui/rn-app'
import {
  cancelSubscription,
  getLiveSubscriptions,
  getSubscriptions,
  unsubscribeLive,
  type Live,
} from '@ihui/api-client'
import { usePaginatedList, useRefreshOnFocus } from '../hooks'
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
  // 直播订阅段(mobile-rn/shared zh-CN 暂无这五键,先由端内兜底)
  'live.subscribe.count': '已订阅',
  'live.subscribe.unit': '场',
  'live.subscribe.reminder': '开播前提醒',
  'live.subscribe.reminderDesc': '订阅直播开播前 10 分钟通知',
  'live.subscribe.discover': '去发现直播',
}

/** 提醒开关持久化键(与小程序 Taro storage 同键,便于跨端口径一致) */
const REMINDER_KEY = 'live_reminder_enabled'

export function SubscriptionsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

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
            error: res.error || uniappT('subscriptions.loadFailed'),
          }
        },
        [uniappT],
      ),
      PAGE_SIZE,
    )
  // 直播订阅(语义变化后的一等数据源):GET /live/subscriptions → 共享屏直播段
  const [liveItems, setLiveItems] = useState<SubscriptionsItem[]>([])
  const loadLive = useCallback(async () => {
    const res = await getLiveSubscriptions()
    if (res.success && res.data) {
      const nowIso = new Date().toISOString()
      setLiveItems(
        (res.data.list || []).map((c: Live) => ({
          id: c.id,
          targetType: 'live',
          targetId: c.id,
          createdAt: '',
          title: c.title,
          coverUrl: c.coverImage,
          anchor: c.lecturerName,
          startTime: c.startTime,
          status: c.isLive ? 'living' : c.startTime > nowIso ? 'upcoming' : 'ended',
        })),
      )
    }
  }, [])

  // 挂载即取一次;回屏/回前台由 useRefreshOnFocus 重取(它跳过首次挂载)
  useEffect(() => {
    void loadLive()
  }, [loadLive])
  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新):分页与直播两路都刷新
  const refreshAll = useCallback(() => {
    refresh()
    void loadLive()
  }, [refresh, loadLive])
  useRefreshOnFocus(refreshAll)

  // 开播前提醒:与小程序同键落 AsyncStorage
  const [reminderEnabled, setReminderEnabled] = useState(false)
  useEffect(() => {
    void AsyncStorage.getItem(REMINDER_KEY)
      .then((v) => setReminderEnabled(v === 'true'))
      .catch(() => {})
  }, [])
  const onToggleReminder = (next: boolean) => {
    setReminderEnabled(next)
    void AsyncStorage.setItem(REMINDER_KEY, String(next)).catch(() => {})
  }

  // 直播行点击 → 直播详情;通用订阅行不注入按压(共享屏只在 onPressItem 存在时包 Pressable)
  const onPressItem = (item: SubscriptionsItem) => {
    if (item.targetType === 'live') {
      navigation.navigate('LiveDetail', { id: item.targetId })
    }
  }

  // 取消订阅确认弹窗:uni.showModal → RN Alert(取消/取消订阅·destructive)
  const onCancel = (item: SubscriptionsItem) => {
    appAlert(uniappT('subscriptions.cancelTitle'), item.targetId, [
      { text: uniappT('common.cancel'), style: 'cancel' },
      {
        text: uniappT('subscriptions.cancel'),
        style: 'destructive',
        onPress: async () => {
          if (item.targetType === 'live') {
            // 直播订阅走 /live/:id/subscribe 的 DELETE,并从本地直播态剔除
            const liveRes = await unsubscribeLive(item.targetId)
            if (liveRes.success) {
              setLiveItems((prev) => prev.filter((l) => l.targetId !== item.targetId))
            } else {
              appAlert(
                uniappT('common.failed'),
                liveRes.error || uniappT('subscriptions.loadFailed'),
              )
            }
            return
          }
          const res = await cancelSubscription(item.targetType, item.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            appAlert(uniappT('common.failed'), res.error || uniappT('subscriptions.loadFailed'))
          }
        },
      },
    ])
  }

  return (
    <SharedSubscriptionsScreen
      t={uniappT}
      items={[...liveItems, ...items]}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      error={error}
      onRefresh={refreshAll}
      onLoadMore={loadMore}
      onCancel={onCancel}
      onBack={() => navigation.goBack()}
      reminderEnabled={reminderEnabled}
      onToggleReminder={onToggleReminder}
      onPressItem={onPressItem}
      onGoDiscover={() => navigation.navigate('LiveList')}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
