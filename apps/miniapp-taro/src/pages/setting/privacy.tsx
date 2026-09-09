// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Switch, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import ThemeRoot from '@/components/ThemeRoot'

// 系统权限项配置:label 走 i18n(settingPrivacy.permissions.<key>)
interface PermissionItem {
  key: string
  scope: string
}

const PERMISSIONS: PermissionItem[] = [
  { key: 'record', scope: 'scope.record' },
  { key: 'camera', scope: 'scope.camera' },
  { key: 'album', scope: 'scope.writePhotosAlbum' },
  { key: 'location', scope: 'scope.userLocation' },
  { key: 'notification', scope: 'subscription' },
]

const PRIVACY_STATUS_KEY: Record<string, string> = {
  granted: 'settingPrivacy.status.granted',
  denied: 'settingPrivacy.status.denied',
  unknown: 'settingPrivacy.status.unknown',
}

const PERMISSION_KEY: Record<string, string> = {
  record: 'settingPrivacy.permissions.record',
  camera: 'settingPrivacy.permissions.camera',
  album: 'settingPrivacy.permissions.album',
  location: 'settingPrivacy.permissions.location',
  notification: 'settingPrivacy.permissions.notification',
}

// 隐私设置项 key
const PRIVACY_KEYS = {
  mute: 'privacy_mute',
  recommend: 'privacy_recommend',
  personalize: 'privacy_personalize',
}

export default function PrivacySettingPage() {
  const { t } = useI18n()
  // 系统权限状态:granted(已授权) / denied(已拒绝) / unknown(未请求)
  const [permStatus, setPermStatus] = useState<Record<string, string>>({})
  // 隐私设置开关
  const [mute, setMute] = useState(false)
  const [recommend, setRecommend] = useState(true)
  const [personalize, setPersonalize] = useState(true)

  // 读取系统权限状态
  const loadPermissions = useCallback(async () => {
    try {
      const setting = await Taro.getSetting()
      const status: Record<string, string> = {}
      for (const item of PERMISSIONS) {
        const auth = setting.authSetting as Record<string, boolean | undefined>
        const val = auth[item.scope]
        if (val === true) status[item.key] = 'granted'
        else if (val === false) status[item.key] = 'denied'
        else status[item.key] = 'unknown'
      }
      setPermStatus(status)
    } catch (e) {
      logger.error('setting/privacy', '获取权限状态', e)
    }
  }, [])

  // 读取本地隐私设置
  const loadPrivacy = useCallback(() => {
    setMute(Taro.getStorageSync(PRIVACY_KEYS.mute) === true)
    setRecommend(Taro.getStorageSync(PRIVACY_KEYS.recommend) !== false)
    setPersonalize(Taro.getStorageSync(PRIVACY_KEYS.personalize) !== false)
  }, [])

  useDidShow(() => {
    loadPermissions()
    loadPrivacy()
  })

  // 打开系统设置页授权
  const onOpenSetting = useCallback(() => {
    Taro.openSetting({
      success: () => loadPermissions(),
    })
  }, [loadPermissions])

  // 切换隐私开关并持久化
  const onToggle = useCallback((key: string, value: boolean) => {
    const storageKey = PRIVACY_KEYS[key as keyof typeof PRIVACY_KEYS]
    if (!storageKey) return
    Taro.setStorageSync(storageKey, value)
    if (key === 'mute') setMute(value)
    else if (key === 'recommend') setRecommend(value)
    else if (key === 'personalize') setPersonalize(value)
  }, [])

  // 跳转隐私政策
  const onPrivacyPolicy = useCallback(() => {
    Taro.navigateTo({ url: '/pages/about/privacy' })
  }, [])

  const statusText = (s: string) =>
    t(PRIVACY_STATUS_KEY[s || 'unknown'] ?? 'settingPrivacy.status.unknown')

  // 隐私开关项展示配置(仅渲染层聚合,onToggle/存储逻辑不变)
  const switchItems = [
    { key: 'mute', label: t('settingPrivacy.mute'), desc: t('settingPrivacy.muteDesc'), value: mute },
    {
      key: 'recommend',
      label: t('settingPrivacy.recommend'),
      desc: t('settingPrivacy.recommendDesc'),
      value: recommend,
    },
    {
      key: 'personalize',
      label: t('settingPrivacy.personalize'),
      desc: t('settingPrivacy.personalizeDesc'),
      value: personalize,
    },
  ]

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN 共享 SecuritySettingsScreen container(surface.bg → --color-background);
          留白对齐 body padding 14dp→28rpx + 页尾 paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[48rpx]">
        {/* 系统权限分组:标题沿用共享 SettingsScreen sectionTitle 视觉(14dp→28rpx +
            text.secondary→muted-foreground);卡片对齐 SecuritySettingsScreen card:
            圆角 12dp→24rpx + border.light 描边 + padding 14dp→28rpx + marginBottom 12dp→24rpx;
            卡面 surface.light 在 RN 暗色仍为纯白导致浅字不可读,按语义 token 修正为 --color-card 随主题 */}
        <View className="mb-[24rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {t('settingPrivacy.systemPermissions')}
          </Text>
          <View className="rounded-[24rpx] border-[1rpx] border-solid border-[color:var(--color-border)] bg-card p-[28rpx]">
            {PERMISSIONS.map((item, idx) => (
              <View
                key={item.key}
                className={`flex items-center justify-between py-[20rpx]${idx > 0 ? ' border-t-[1rpx] border-solid border-[color:var(--color-border)]' : ''}`}
              >
                <View className="mr-[16rpx] min-w-0 flex-1">
                  {/* label 对齐 RN: 14dp→28rpx + text.medium 语义映射 muted-foreground */}
                  <Text className="text-[28rpx] text-muted-foreground">
                    {t(PERMISSION_KEY[item.key] ?? 'settingPrivacy.permissions.record')}
                  </Text>
                  {/* 权限状态为小程序端补充信息(RN 无对应行):24rpx;
                      granted→--color-success / denied→--color-destructive / unknown→text.tertiary */}
                  <Text
                    className={`mt-[4rpx] text-[24rpx] ${
                      permStatus[item.key] === 'granted'
                        ? 'text-[color:var(--color-success)]'
                        : permStatus[item.key] === 'denied'
                          ? 'text-[color:var(--color-destructive)]'
                          : 'text-[color:var(--color-text-tertiary)]'
                    }`}
                  >
                    {statusText(permStatus[item.key] || 'unknown')}
                  </Text>
                </View>
                {/* 「去设置」为小程序端补充动作(RN 无对应元素):次级 chip,
                    secondary 底 + border.light 描边,圆角对齐 card 12dp→24rpx 的一半(16rpx) */}
                <Button
                  className="m-0 ml-[16rpx] h-[56rpx] shrink-0 rounded-[16rpx] border-[1rpx] border-solid border-[color:var(--color-border)] bg-secondary px-[24rpx] text-[24rpx] leading-[56rpx] text-secondary-foreground"
                  size="mini"
                  onClick={onOpenSetting}
                >
                  {t('settingPrivacy.goSetting')}
                </Button>
              </View>
            ))}
          </View>
        </View>

        {/* 隐私开关分组:行对齐 SecuritySettingsScreen row(py 10dp→20rpx +
            rowDivider borderTop border.light);Switch trackColor true=brand.DEFAULT → --color-primary */}
        <View className="mb-[24rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {t('settingPrivacy.privacySettings')}
          </Text>
          <View className="rounded-[24rpx] border-[1rpx] border-solid border-[color:var(--color-border)] bg-card p-[28rpx]">
            {switchItems.map((item, idx) => (
              <View
                key={item.key}
                className={`flex items-center justify-between py-[20rpx]${idx > 0 ? ' border-t-[1rpx] border-solid border-[color:var(--color-border)]' : ''}`}
              >
                <View className="mr-[16rpx] min-w-0 flex-1">
                  <Text className="text-[28rpx] text-muted-foreground">{item.label}</Text>
                  <Text className="mt-[4rpx] block text-[24rpx] leading-[1.5] text-[color:var(--color-text-tertiary)]">
                    {item.desc}
                  </Text>
                </View>
                <Switch
                  checked={item.value}
                  color="var(--color-primary)"
                  onChange={(e) => onToggle(item.key, e.detail.value)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* 底部隐私政策链接(小程序端补充入口,RN 无对应元素):
            字号/留白对齐 versionText 12dp→24rpx 居中,链接色用 --color-link 语义 token */}
        <View className="mt-[8rpx] text-center">
          <Text
            className="text-[24rpx] text-[color:var(--color-link)] underline"
            onClick={onPrivacyPolicy}
          >
            {t('settingPrivacy.privacyPolicy')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
