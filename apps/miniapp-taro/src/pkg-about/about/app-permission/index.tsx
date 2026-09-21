// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import ThemeRoot from '@/components/ThemeRoot'

const REQUIRED_FLAGS = [true, false, true, false, false, true]
const ALBUM_NAME_FB = t('about.appPermission.albumName')
const ALBUM_DESC_FB = t('about.appPermission.albumDesc')

type PermissionStatus = 'granted' | 'denied' | 'unknown'

interface Permission {
  name: string
  desc: string
  required: boolean
  scope: string
}

export default function AppPermission() {
  const { t, tList } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [statusMap, setStatusMap] = useState<Record<string, PermissionStatus>>({})

  const names = tList('about.appPermission.names')
  const descs = tList('about.appPermission.descs')
  const hasAlbum = names.length >= 6
  const permissionNames = hasAlbum
    ? names
    : [...names, tt('about.appPermission.albumName', ALBUM_NAME_FB)]
  const permissionDescs = hasAlbum
    ? descs
    : [...descs, tt('about.appPermission.albumDesc', ALBUM_DESC_FB)]
  const SCOPES = [
    'scope.writePhotosAlbum',
    'scope.camera',
    'scope.record',
    'scope.userLocation',
    'scope.notification',
    'scope.writePhotosAlbum',
  ]
  const permissions: Permission[] = permissionNames.map((name, i) => ({
    name,
    desc: permissionDescs[i] || '',
    required: REQUIRED_FLAGS[i] ?? false,
    scope: SCOPES[i] || `scope.${name}`,
  }))

  const load = useCallback(async () => {
    const result: Record<string, PermissionStatus> = {}
    for (const p of permissions) {
      try {
        const res = await Taro.getSetting()
        const authSetting = res.authSetting as Record<string, boolean>
        if (authSetting[p.scope] === true) {
          result[p.scope] = 'granted'
        } else if (authSetting[p.scope] === false) {
          result[p.scope] = 'denied'
        } else {
          result[p.scope] = 'unknown'
        }
      } catch (e) {
        logger.error('about/app-permission', t('aboutApppermission.q1'), e)
        result[p.scope] = 'unknown'
      }
    }
    setStatusMap(result)
  }, [permissions, t])

  const onOpenSetting = useCallback(() => {
    Taro.openSetting({
      success: () => {
        setTimeout(() => load(), 500)
      },
    })
  }, [load])

  const statusText = useCallback(
    (scope: string): string => {
      const s = statusMap[scope]
      if (s === 'granted') return tt('about.appPermission.granted', '已授权')
      if (s === 'denied') return tt('about.appPermission.denied', '已拒绝')
      return tt('about.appPermission.unknown', '未授权')
    },
    [statusMap, tt],
  )

  const statusClass = useCallback(
    (scope: string): string => {
      const s = statusMap[scope]
      const base = 'text-[22rpx] py-[2rpx] px-[12rpx] rounded-[6rpx] ml-auto'
      if (s === 'granted') return `${base} text-success bg-success/10`
      if (s === 'denied') return `${base} text-destructive bg-destructive/10`
      return `${base} text-muted-foreground bg-background`
    },
    [statusMap],
  )

  useDidShow(() => load())

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[64rpx] flex flex-col gap-[24rpx]">
        <Text className="block text-[28rpx] text-muted-foreground leading-[44rpx] px-[8rpx] py-[8rpx]">
          {t('about.appPermission.intro')}
        </Text>

        {permissions.map((p) => (
          <View key={p.scope} className="bg-card rounded-[24rpx] border border-border p-[28rpx]">
            <View className="flex items-start">
              <View className="flex-1 mr-[16rpx]">
                <View className="flex items-center flex-wrap gap-[12rpx]">
                  <Text className="text-[32rpx] font-semibold text-foreground">{p.name}</Text>
                  {p.required ? (
                    <Text className="text-[20rpx] text-destructive-foreground bg-destructive py-[2rpx] px-[12rpx] rounded-[6rpx]">
                      {t('about.appPermission.required')}
                    </Text>
                  ) : (
                    <Text className="text-[20rpx] text-muted-foreground bg-muted py-[2rpx] px-[12rpx] rounded-[6rpx]">
                      {t('about.appPermission.optional')}
                    </Text>
                  )}
                  <Text className={statusClass(p.scope)}>{statusText(p.scope)}</Text>
                </View>
                <Text className="block text-[28rpx] text-muted-foreground leading-[44rpx] mt-[16rpx]">
                  {p.desc}
                </Text>
              </View>
              <Button
                className="flex-shrink-0 text-[24rpx] bg-primary text-[var(--color-primary-foreground)] rounded-[16rpx] px-[20rpx] leading-[56rpx] m-0 after:border-0"
                size="mini"
                onClick={onOpenSetting}
              >
                {tt('about.appPermission.goSetting', '去设置')}
              </Button>
            </View>
          </View>
        ))}

        <View
          className="bg-card rounded-[24rpx] border border-border p-[28rpx] flex items-center justify-between"
          onClick={onOpenSetting}
          hoverClass="opacity-60"
        >
          <Text className="text-[32rpx] font-semibold text-foreground">
            {tt('about.appPermission.openAllSetting', '打开系统设置')}
          </Text>
          <Text className="text-[var(--color-text-medium)] text-[32rpx]">›</Text>
        </View>

        <Text className="block text-center text-[22rpx] text-muted-foreground pt-[8rpx]">
          {t('about.appPermission.footer')}
        </Text>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
