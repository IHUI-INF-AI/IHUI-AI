// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, Switch } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getLiveList, del, type Live } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const REMINDER_KEY = 'live_reminder_enabled'

const STATUS_BADGE: Record<Live['status'], string> = {
  upcoming: 'bg-[var(--color-warning-tint)] text-[var(--color-warning)]',
  living: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  ended: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
}

const STATUS_LABEL: Record<Live['status'], { key: string; fb: string }> = {
  upcoming: { key: 'live.calendar.upcoming', fb: '即将开始' },
  living: { key: 'live.liveNow', fb: '进行中' },
  ended: { key: 'live.ended', fb: '已结束' },
}

export default function LiveSubscribe() {
  const tt = useTt()

  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(false)
  const [reminder, setReminder] = useState<boolean>(Taro.getStorageSync(REMINDER_KEY) === 'true')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getLiveList({ status: 'upcoming' })
      setList(res.list || [])
    } catch (e) {
      logger.error('live/subscribe', '获取订阅列表', e)
      Taro.showToast({
        title: tt('live.subscribe.loadFailed', '订阅操作失败'),
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }, [tt])

  useDidShow(() => {
    load()
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const onUnsubscribe = useCallback(
    async (id: string | number) => {
      try {
        await del(`/live/${id}/unsubscribe`)
        setList((prev) => prev.filter((l) => l.id !== id))
        Taro.showToast({
          title: tt('live.subscribe.unsubscribed', '已取消订阅'),
          icon: 'success',
        })
      } catch (e) {
        logger.error('live/subscribe', '取消订阅', e)
      }
    },
    [tt],
  )

  const toggleReminder = (val: boolean) => {
    setReminder(val)
    Taro.setStorageSync(REMINDER_KEY, String(val))
    Taro.showToast({
      title: tt('live.subscribe.reminderSaved', '设置已保存'),
      icon: 'success',
    })
  }

  const goDetail = (id: string | number) => Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })

  const goDiscover = () => Taro.navigateTo({ url: '/pages/live/list' })

  const statusText = (s: Live['status']) => tt(STATUS_LABEL[s].key, STATUS_LABEL[s].fb)

  return (
    <ThemeRoot>
      {/* 对齐 RN shared SubscriptionsScreen container(tk.surface.bg)+ listBody(padding 10 → 20rpx,paddingBottom 32 → 64rpx) */}
      <View className="min-h-screen bg-[var(--color-background)] px-[20rpx] pt-[20rpx] pb-[64rpx] box-border">
        <View className="flex items-baseline text-[28rpx] text-foreground">
          <Text>{tt('live.subscribe.count', '已订阅')}</Text>
          <Text className="font-bold text-[40rpx] text-primary mx-[8rpx]">{list.length}</Text>
          <Text>{tt('live.subscribe.unit', '场')}</Text>
        </View>

        {/* 开播前提醒卡片:对齐 RN card(p 12 → 24rpx,radius 12 → 24rpx,1px border.light → 2rpx var(--color-border)) */}
        <View className="mt-[20rpx] flex items-center justify-between p-[24rpx] border-[2rpx] border-[var(--color-border)] rounded-[24rpx]">
          <View>
            <Text className="text-[28rpx] text-foreground">
              {tt('live.subscribe.reminder', '开播前提醒')}
            </Text>
            <Text className="text-[24rpx] text-muted-foreground mt-[6rpx]">
              {tt('live.subscribe.reminderDesc', '订阅直播开播前 10 分钟通知')}
            </Text>
          </View>
          <Switch checked={reminder} onChange={(e) => toggleReminder(e.detail.value)} />
        </View>

        {list.length > 0 ? (
          /* 对齐 RN FlatList separator(height 12 → 24rpx) */
          <View className="mt-[24rpx] flex flex-col gap-[24rpx]">
            {list.map((l) => (
              /* 对齐 RN card:row + items-center,无卡片底色 */
              <View
                key={l.id}
                className="flex items-center p-[24rpx] border-[2rpx] border-[var(--color-border)] rounded-[24rpx]"
              >
                {/* 对齐 RN thumb(40dp → 80rpx,radius 24rpx,bg muted) */}
                <Image
                  className="w-[80rpx] h-[80rpx] shrink-0 bg-muted rounded-[24rpx]"
                  src={l.coverUrl}
                  mode="aspectFill"
                  onClick={() => goDetail(l.id)}
                />
                <View
                  className="flex-1 min-w-0 ml-[24rpx] flex flex-col"
                  onClick={() => goDetail(l.id)}
                  hoverClass="opacity-60"
                >
                  {/* 对齐 RN targetId(16dp → 32rpx semibold,单行截断) */}
                  <Text className="overflow-hidden whitespace-nowrap text-ellipsis text-[32rpx] font-semibold text-foreground">
                    {l.title}
                  </Text>
                  {/* 对齐 RN createdAt(14dp → 28rpx,text.secondary) */}
                  {l.anchor && (
                    <Text className="text-[28rpx] text-muted-foreground mt-[16rpx]">
                      {l.anchor}
                    </Text>
                  )}
                  {l.startTime && (
                    <Text className="text-[28rpx] text-muted-foreground mt-[16rpx]">
                      {l.startTime}
                    </Text>
                  )}
                  <View className="flex items-center justify-between mt-[16rpx]">
                    <Text
                      className={`px-[16rpx] py-[4rpx] rounded-[12rpx] text-[22rpx] ${STATUS_BADGE[l.status]}`}
                    >
                      {statusText(l.status)}
                    </Text>
                    {/* 对齐 RN cancelBtn(px 12 → 24rpx,py 6 → 12rpx,radius 24rpx,border + 中性文字) */}
                    <Text
                      className="px-[24rpx] py-[12rpx] text-[28rpx] font-semibold text-[var(--color-text-medium)] border-[2rpx] border-[var(--color-border)] rounded-[24rpx]"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnsubscribe(l.id)
                      }}
                    >
                      {tt('live.subscribe.unsubscribe', '取消订阅')}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          /* 对齐 RN center(paddingVertical 48 → 96rpx)+ muted(14 → 28rpx) */
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('live.subscribe.empty', '暂无订阅')}
            </Text>
            <Text
              className="mt-[24rpx] text-[28rpx] font-semibold text-[var(--color-brand-orange)]"
              onClick={goDiscover}
            >
              {tt('live.subscribe.discover', '去发现直播')}
            </Text>
          </View>
        )}

        {loading && (
          <View className="text-center text-[28rpx] text-muted-foreground py-[32rpx]">
            <Text>{tt('common.loading', '加载中…')}</Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
