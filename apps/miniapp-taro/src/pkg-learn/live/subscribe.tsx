// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染交给共享屏 packages/app/src/features/subscriptions/SubscriptionsScreen.tsx
// 语义变化:本页由「全部即将开播」改为「我订阅的频道」(GET /live/subscriptions)。
import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getLiveSubscriptions, unsubscribeLive } from '@/api'
import type { Live } from '@ihui/api-client'
import ThemeRoot from '@/components/ThemeRoot'
import { SubscriptionsScreen } from '@ihui/rn-app/features/subscriptions/SubscriptionsScreen'
import type { SubscriptionsItem } from '@ihui/types'
import { useAppTheme } from '@/lib/theme'
import { onToast } from '@/host/on-toast'

const REMINDER_KEY = 'live_reminder_enabled'

/** 缺键兜底:小程序 zh-CN 暂无 live.subscribe.* 五键(live.ended 亦缺) */
const SCREEN_TEXT: Record<string, string> = {
  'subscriptions.title': '我的订阅',
  'live.subscribe.count': '已订阅',
  'live.subscribe.unit': '场',
  'live.subscribe.reminder': '开播前提醒',
  'live.subscribe.reminderDesc': '订阅直播开播前 10 分钟通知',
  'live.subscribe.discover': '去发现直播',
  'live.ongoing': '直播中',
  'live.upcoming': '即将开播',
  'live.ended': '已结束',
  'subscriptions.empty': '暂无订阅',
  'memberSubscriptionPage.cancelSubscription': '取消订阅',
  'common.loading': '加载中…',
}

export default function LiveSubscribe() {
  const tt = useTt()
  const { resolved } = useAppTheme()

  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(false)
  const [reminder, setReminder] = useState<boolean>(Taro.getStorageSync(REMINDER_KEY) === 'true')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getLiveSubscriptions()
      if (res.success) {
        setList(res.data.list || [])
      } else {
        throw new Error(res.error)
      }
    } catch (e) {
      logger.error('live/subscribe', '获取订阅列表', e)
      onToast(tt('live.subscribe.loadFailed', '订阅操作失败'), { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tt])

  useDidShow(() => {
    void load()
  })

  usePullDownRefresh(() => {
    void load().finally(() => Taro.stopPullDownRefresh())
  })

  const onCancel = useCallback(
    async (item: SubscriptionsItem) => {
      try {
        const res = await unsubscribeLive(item.targetId)
        if (!res.success) throw new Error(res.error)
        setList((prev) => prev.filter((l) => String(l.id) !== item.targetId))
        onToast(tt('live.subscribe.unsubscribed', '已取消订阅'), { kind: 'success' })
      } catch (e) {
        logger.error('live/subscribe', '取消订阅', e)
        onToast(tt('live.subscribe.loadFailed', '订阅操作失败'), { kind: 'error' })
      }
    },
    [tt],
  )

  const toggleReminder = (next: boolean) => {
    setReminder(next)
    Taro.setStorageSync(REMINDER_KEY, String(next))
    onToast(tt('live.subscribe.reminderSaved', '设置已保存'), { kind: 'success' })
  }

  const goDetail = (item: SubscriptionsItem) => {
    if (item.targetType === 'live') {
      Taro.navigateTo({ url: `/pkg-learn/live/detail?id=${item.targetId}` })
    }
  }

  const goDiscover = () => Taro.navigateTo({ url: '/pkg-learn/live/list' })

  const nowIso = new Date().toISOString()
  const items: SubscriptionsItem[] = list.map((c) => ({
    id: String(c.id),
    targetType: 'live',
    targetId: String(c.id),
    createdAt: '',
    title: c.title,
    coverUrl: c.coverImage,
    anchor: c.lecturerName,
    startTime: c.startTime,
    status: c.isLive ? 'living' : c.startTime > nowIso ? 'upcoming' : 'ended',
  }))

  // 共享屏只按单参 t(key) 取文案,这里补小程序缺键的兜底
  const screenT = useCallback((key: string) => tt(key, SCREEN_TEXT[key] ?? key), [tt])

  return (
    <ThemeRoot className="page">
      <SubscriptionsScreen
        t={screenT}
        items={items}
        loading={loading}
        refreshing={false}
        loadingMore={false}
        error=""
        onRefresh={() => {
          void load()
        }}
        onLoadMore={() => {}}
        onCancel={onCancel}
        reminderEnabled={reminder}
        onToggleReminder={toggleReminder}
        onPressItem={goDetail}
        onGoDiscover={goDiscover}
        colorScheme={resolved}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
