// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/notification-settings/NotificationSettingsScreen.tsx
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { requestPushSubscription } from '@/utils/push-init'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { EmptyState, ScreenSkeleton } from '@/components/ScreenStates.taro'
import LineIcon from '@/components/LineIcon'
import { getRnTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'

interface NotificationSettingItem {
  key: string
  title: string
  enabled: boolean
}

export default function NotificationPage() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  /* 微信 <switch color> 走 wxml 原生属性位、不解析 CSS 变量 ⇒ 必须 JS 派生 hex。
     取墨档 brand.DEFAULT(亮 #000000 / 暗 #FFFFFF,随主题翻转),与 RN trackColor.true 同档。 */
  const { resolved } = useAppTheme()
  const switchInk = getRnTokens(resolved).brand.DEFAULT
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

  // G-933 冷启动抢跑门控:挂载唯一一支 GET /api/settings/notification 需鉴权
  // (apps/api/src/routes/miniapp-compat-routes.ts:2516 handler 内
  // `if (!(await checkAuth(request, reply))) return`,注册前缀 /api 见 routes/index.ts:1045)
  // ⇒ 挡到门后。等待期间由既有 loading 分支(加载中)承载;
  // 开关那一支 PUT /api/settings/notification 由用户点击触发,不属挂载抢跑,原样不动。
  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load()
    })
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

  // 微信订阅消息授权(一次性授权,消耗后需再次订阅才能收到下一条推送)
  const onSubscribeWx = useCallback(async () => {
    const accepted = await requestPushSubscription()
    if (accepted) {
      Taro.showToast({
        title: tt('setting.notification.subscribed', '已开启提醒订阅'),
        icon: 'success',
      })
    } else {
      logger.info('setting/notification', 'subscribe-rejected', '用户未同意订阅或未配置模板')
      Taro.showToast({
        title: tt('setting.notification.subscribeFailed', '未开启订阅,可稍后重试'),
        icon: 'none',
      })
    }
  }, [tt])

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN 共享 NotificationSettingsScreen container(surface.bg → --color-background);
          留白对齐 body padding 10dp→20rpx + 页尾 paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        {/* 分组标题沿用共享 SettingsScreen sectionTitle 视觉:14dp→28rpx(text.secondary) */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[length:28rpx] text-muted-foreground">
            {tt('setting.notification.categoryTitle', '通知分类')}
          </Text>
          {/* 卡片对齐 RN card: 圆角 12dp→24rpx + padding 12dp→24rpx + surface.light→--color-card
              (RN 暗色仍用白色卡面导致浅字不可读,按语义 token 修正为 --color-card 随主题) */}
          <View className="rounded-lg bg-card p-[24rpx]">
            {loading ? (
              <ScreenSkeleton variant="list" count={4} />
            ) : list.length === 0 ? (
              <EmptyState title={tt('setting.notification.empty', '暂无通知设置项')} />
            ) : (
              list.map((item) => (
                <View key={item.key} className="flex items-center justify-between py-[20rpx]">
                  <View className="mr-[16rpx] flex-1">
                    {/* label 对齐 RN: 14dp→28rpx + text.medium 语义映射 muted-foreground */}
                    <Text className="text-[length:28rpx] text-muted-foreground">{item.title}</Text>
                  </View>

                  {/* Switch 对齐 RN trackColor.true = brand.DEFAULT(源 --color-primary 墨档);
                      原生属性位不解析 var(),取 JS 派生 switchInk */}
                  <Switch
                    checked={item.enabled}
                    color={switchInk}
                    onChange={(e) => onToggle(item.key, e.detail.value)}
                  />
                </View>
              ))
            )}
          </View>
        </View>

        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[length:28rpx] text-muted-foreground">
            {tt('setting.notification.moreTitle', '更多')}
          </Text>
          <View className="rounded-lg bg-card p-[24rpx]">
            <View
              className="flex items-center justify-between py-[20rpx]"
              onClick={() => void onSubscribeWx()}
              hoverClass="opacity-60"
            >
              <View className="mr-[16rpx] flex-1">
                <Text className="text-[length:28rpx] text-muted-foreground">
                  {tt('setting.notification.wxSubscribe', '微信催费提醒')}
                </Text>
                <Text className="mt-[6rpx] block text-[length:24rpx] leading-[1.5] text-[color:var(--color-text-tertiary)]">
                  {tt(
                    'setting.notification.wxSubscribeDesc',
                    '订阅后可在微信接收学费催缴提醒(每次订阅可收一条)',
                  )}
                </Text>
              </View>
              {/* arrow 对齐 RN plainRow arrow: 20dp→40rpx + text.tertiary */}
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex items-center justify-between py-[20rpx]"
              onClick={() => Taro.navigateTo({ url: '/pkg-user/bill/index' })}
              hoverClass="opacity-60"
            >
              <View className="mr-[16rpx] flex-1">
                <Text className="text-[length:28rpx] text-muted-foreground">
                  {tt('setting.notification.myBills', '我的学费账单')}
                </Text>
                <Text className="mt-[6rpx] block text-[length:24rpx] leading-[1.5] text-[color:var(--color-text-tertiary)]">
                  {tt('setting.notification.myBillsDesc', '查看应缴/已缴/欠费并在线缴费')}
                </Text>
              </View>
              {/* arrow 对齐 RN plainRow arrow: 20dp→40rpx + text.tertiary */}
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex items-center justify-between py-[20rpx]"
              onClick={onDetail}
              hoverClass="opacity-60"
            >
              <View className="mr-[16rpx] flex-1">
                <Text className="text-[length:28rpx] text-muted-foreground">
                  {tt('setting.notification.detail', '通知详情')}
                </Text>
                <Text className="mt-[6rpx] block text-[length:24rpx] leading-[1.5] text-[color:var(--color-text-tertiary)]">
                  {tt('setting.notification.detailDesc', '查看历史通知消息')}
                </Text>
              </View>
              {/* arrow 对齐 RN plainRow arrow: 20dp→40rpx + text.tertiary */}
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
