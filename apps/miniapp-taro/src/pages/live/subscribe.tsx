import { logger } from '@/utils/logger'
import { View, Text, Image, Switch } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getLiveList, type Live } from '@/api'
import { del } from '@/utils/request'
import { useI18n } from '@/i18n'

const REMINDER_KEY = 'live_reminder_enabled'

const STATUS_BADGE: Record<Live['status'], string> = {
  upcoming: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]',
  living: 'bg-[rgba(221,82,77,0.12)] text-[#dd524d]',
  ended: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<Live['status'], { key: string; fb: string }> = {
  upcoming: { key: 'live.calendar.upcoming', fb: '即将开始' },
  living: { key: 'live.liveNow', fb: '进行中' },
  ended: { key: 'live.ended', fb: '已结束' },
}

export default function LiveSubscribe() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

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
    <View className="min-h-screen bg-background p-[24rpx] pb-[60rpx] box-border">
      <View className="flex items-baseline text-[28rpx] text-foreground">
        <Text>{tt('live.subscribe.count', '已订阅')}</Text>
        <Text className="font-bold text-[40rpx] text-primary mx-[8rpx]">{list.length}</Text>
        <Text>{tt('live.subscribe.unit', '场')}</Text>
      </View>

      <View className="mt-[20rpx] flex items-center justify-between p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]">
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
        <View className="mt-[24rpx] flex flex-col gap-[16rpx]">
          {list.map((l) => (
            <View
              key={l.id}
              className="flex items-stretch p-[20rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]"
            >
              <Image
                className="w-[160rpx] h-[120rpx] shrink-0 bg-muted rounded-[8rpx]"
                src={l.coverUrl}
                mode="aspectFill"
                onClick={() => goDetail(l.id)}
              />
              <View
                className="flex-1 min-w-0 ml-[20rpx] flex flex-col justify-between"
                onClick={() => goDetail(l.id)}
              >
                <Text className="text-[28rpx] font-semibold text-foreground">{l.title}</Text>
                {l.anchor && <Text className="text-[24rpx] text-muted-foreground">{l.anchor}</Text>}
                {l.startTime && (
                  <Text className="text-[24rpx] text-muted-foreground">{l.startTime}</Text>
                )}
                <View className="flex items-center justify-between">
                  <Text
                    className={`px-[12rpx] py-[4rpx] rounded-[6rpx] text-[22rpx] ${STATUS_BADGE[l.status]}`}
                  >
                    {statusText(l.status)}
                  </Text>
                  <Text
                    className="px-[20rpx] py-[8rpx] text-[24rpx] text-destructive bg-[rgba(221,82,77,0.08)] border-[2rpx] border-[rgba(221,82,77,0.25)] rounded-[8rpx]"
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
        <View className="flex flex-col items-center py-[120rpx]">
          <Text className="text-[28rpx] text-muted-foreground">
            {tt('live.subscribe.empty', '暂无订阅')}
          </Text>
          <Text
            className="mt-[24rpx] px-[48rpx] py-[16rpx] text-[28rpx] text-primary bg-[rgba(0,242,255,0.1)] border-[2rpx] border-[rgba(0,242,255,0.3)] rounded-[8rpx]"
            onClick={goDiscover}
          >
            {tt('live.subscribe.discover', '去发现直播')}
          </Text>
        </View>
      )}

      {loading && (
        <View className="text-center text-[26rpx] text-muted-foreground py-[60rpx]">
          <Text>{tt('common.loading', '加载中…')}</Text>
        </View>
      )}
    </View>
  )
}
