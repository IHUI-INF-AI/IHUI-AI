// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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
  }, [tt])

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
    Taro.navigateTo({ url: '/pkg-user/message/index' })
  }, [])

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN 共享 NotificationSettingsScreen container(surface.bg → --color-background);
          留白对齐 body padding 10dp→20rpx + 页尾 paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        {/* 分组标题沿用共享 SettingsScreen sectionTitle 视觉:14dp→28rpx(text.secondary) */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {tt('setting.notification.categoryTitle', '通知分类')}
          </Text>
          {/* 卡片对齐 RN card: 圆角 12dp→24rpx + padding 12dp→24rpx + surface.light→--color-card
              (RN 暗色仍用白色卡面导致浅字不可读,按语义 token 修正为 --color-card 随主题) */}
          <View className="rounded-[24rpx] bg-card p-[24rpx]">
            {loading ? (
              <View className="py-[60rpx] text-center">
                {/* muted 对齐 RN: 14dp→28rpx + text.secondary */}
                <Text className="text-[28rpx] text-muted-foreground">
                  {tt('common.loading', '加载中…')}
                </Text>
              </View>
            ) : list.length === 0 ? (
              <View className="py-[60rpx] text-center">
                <Text className="text-[28rpx] text-muted-foreground">
                  {tt('setting.notification.empty', '暂无通知设置项')}
                </Text>
              </View>
            ) : (
              list.map((item, idx) => (
                <View
                  key={item.key}
                  className={`flex items-center justify-between py-[20rpx]${idx > 0 ? ' border-t-[1rpx] border-solid border-[color:var(--color-border)]' : ''}`}
                >
                  <View className="mr-[16rpx] flex-1">
                    {/* label 对齐 RN: 14dp→28rpx + text.medium 语义映射 muted-foreground */}
                    <Text className="text-[28rpx] text-muted-foreground">{item.title}</Text>
                  </View>

                  {/* Switch trackColor true 对齐 RN brand.DEFAULT → --color-primary */}
                  <Switch
                    checked={item.enabled}
                    color="var(--color-primary)"
                    onChange={(e) => onToggle(item.key, e.detail.value)}
                  />
                </View>
              ))
            )}
          </View>
        </View>

        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {tt('setting.notification.moreTitle', '更多')}
          </Text>
          <View className="rounded-[24rpx] bg-card p-[24rpx]">
            <View
              className="flex items-center justify-between py-[20rpx]"
              onClick={onDetail}
              hoverClass="opacity-60"
            >
              <View className="mr-[16rpx] flex-1">
                <Text className="text-[28rpx] text-muted-foreground">
                  {tt('setting.notification.detail', '通知详情')}
                </Text>
                <Text className="mt-[6rpx] block text-[24rpx] leading-[1.5] text-[color:var(--color-text-tertiary)]">
                  {tt('setting.notification.detailDesc', '查看历史通知消息')}
                </Text>
              </View>
              {/* arrow 对齐 RN plainRow arrow: 20dp→40rpx + text.tertiary */}
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
