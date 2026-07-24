import { logger } from '@/utils/logger'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '@/api'
import { useI18n } from '@/i18n'

interface NotificationSettingItem {
  key: string
  title: string
  enabled: boolean
}

export default function NotificationPage() {
  const { t } = useI18n()
  const [list, setList] = useState<NotificationSettingItem[]>([])
  const [loading, setLoading] = useState(true)
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getNotificationSettings()
      setList(res.list || [])
    } catch (e) {
      logger.error('setting/notification', '获取通知设置', e)
      Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t, tt])

  useDidShow(() => {
    load()
  })

  const onToggle = useCallback(
    (key: string, value: boolean) => {
      setList((prev) => prev.map((item) => (item.key === key ? { ...item, enabled: value } : item)))
      updateNotificationSettings({ [key]: value }).catch((e) => {
        logger.error('setting/notification', '更新通知设置', e)
        Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
      })
    },
    [tt],
  )

  const onDetail = useCallback(() => {
    Taro.navigateTo({ url: '/pages/message/index' })
  }, [])

  return (
    <View className="min-h-screen bg-background">
      <View className="px-[32rpx] pt-[32rpx] pb-[16rpx]">
        <Text className="text-[24rpx] text-muted-foreground">{tt('setting.notification.categoryTitle', '通知分类')}</Text>
      </View>
      <View className="mx-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        {loading ? (
          <View className="px-[32rpx] py-[60rpx] text-center">
            <Text className="text-[26rpx] text-muted-foreground">{tt('common.loading', '加载中…')}</Text>
          </View>
        ) : list.length === 0 ? (
          <View className="px-[32rpx] py-[60rpx] text-center">
            <Text className="text-[26rpx] text-muted-foreground">{tt('setting.notification.empty', '暂无通知设置项')}</Text>
          </View>
        ) : (
          list.map((item, idx) => (
            <View
              key={item.key}
              className={`flex items-center justify-between px-[32rpx] py-[28rpx]${idx > 0 ? ' mt-[16rpx]' : ''}`}
            >
              <View className="flex-1 mr-[16rpx]">
                <Text className="text-[28rpx] text-foreground">{item.title}</Text>
              </View>
              <Switch
                checked={item.enabled}
                color="#00b96b"
                onChange={(e) => onToggle(item.key, e.detail.value)}
              />
            </View>
          ))
        )}
      </View>

      <View className="px-[32rpx] pt-[32rpx] pb-[16rpx]">
        <Text className="text-[24rpx] text-muted-foreground">{tt('setting.notification.moreTitle', '更多')}</Text>
      </View>
      <View className="mx-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        <View className="flex items-center justify-between px-[32rpx] py-[28rpx]" onClick={onDetail}>
          <View className="flex-1 mr-[16rpx]">
            <Text className="text-[28rpx] text-foreground">
              {tt('setting.notification.detail', '通知详情')}
            </Text>
            <Text className="block text-[22rpx] text-muted-foreground mt-[6rpx] leading-[1.5]">
              {tt('setting.notification.detailDesc', '查看历史通知消息')}
            </Text>
          </View>
          <Text className="text-[32rpx] text-muted-foreground">›</Text>
        </View>
      </View>
    </View>
  )
}
