// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import ThemeRoot from '@/components/ThemeRoot'
import { SecuritySettingsScreen as SharedSecuritySettingsScreen } from '@ihui/rn-app/features/security-settings/SecuritySettingsScreen'
import type { SecuritySettingsSection } from '@ihui/types'
import { useAppTheme } from '@/lib/theme'

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

/**
 * 批次 6 薄壳:渲染全部交给共享 SecuritySettingsScreen,本页只留小程序端的数据编排。
 * 两端显式传值且不同:小程序 = 系统权限 5 行(只读读数 + 「去设置」chip)+ 本地隐私 3 行(开关);
 * RN = 账号安全 4 行(只读读数,两步验证行按宿主在册注入入口)。
 * 页内 header 小程序没有 ⇒ showHeader=false(RN true);底部链接两端都传且目标不同。
 */
export default function PrivacySettingPage() {
  const { t } = useI18n()
  const { resolved } = useAppTheme()
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
    Taro.navigateTo({ url: '/pkg-about/about/privacy' })
  }, [])

  const onBack = useCallback(() => {
    void Taro.navigateBack()
  }, [])

  const statusText = useCallback(
    (s: string) => t(PRIVACY_STATUS_KEY[s || 'unknown'] ?? 'settingPrivacy.status.unknown'),
    [t],
  )

  const sections: readonly SecuritySettingsSection[] = useMemo(
    () => [
      {
        key: 'permissions',
        title: t('settingPrivacy.systemPermissions'),
        items: PERMISSIONS.map((item) => ({
          key: item.key,
          label: t(PERMISSION_KEY[item.key] ?? 'settingPrivacy.permissions.record'),
          stateText: statusText(permStatus[item.key] || 'unknown'),
          stateTone:
            permStatus[item.key] === 'granted'
              ? ('success' as const)
              : permStatus[item.key] === 'denied'
                ? ('danger' as const)
                : ('muted' as const),
          action: { label: t('settingPrivacy.goSetting'), onPress: onOpenSetting },
        })),
      },
      {
        key: 'privacy',
        title: t('settingPrivacy.privacySettings'),
        items: [
          {
            key: 'mute',
            label: t('settingPrivacy.mute'),
            desc: t('settingPrivacy.muteDesc'),
            value: mute,
            onToggle: (v: boolean) => onToggle('mute', v),
          },
          {
            key: 'recommend',
            label: t('settingPrivacy.recommend'),
            desc: t('settingPrivacy.recommendDesc'),
            value: recommend,
            onToggle: (v: boolean) => onToggle('recommend', v),
          },
          {
            key: 'personalize',
            label: t('settingPrivacy.personalize'),
            desc: t('settingPrivacy.personalizeDesc'),
            value: personalize,
            onToggle: (v: boolean) => onToggle('personalize', v),
          },
        ],
      },
    ],
    [t, statusText, permStatus, mute, recommend, personalize, onOpenSetting, onToggle],
  )

  return (
    <ThemeRoot>
      <SharedSecuritySettingsScreen
        t={t}
        sections={sections}
        showHeader={false}
        footerLink={{ label: t('settingPrivacy.privacyPolicy'), onPress: onPrivacyPolicy }}
        loading={false}
        error=""
        onBack={onBack}
        colorScheme={resolved}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
