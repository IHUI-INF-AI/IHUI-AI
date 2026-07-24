import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { useI18n } from '@/i18n'

const REQUIRED_FLAGS = [true, false, true, false, false, true]
const ALBUM_NAME_FB = '相册权限'
const ALBUM_DESC_FB = '用于保存和上传图片到相册'

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
        logger.error('about/app-permission', '获取权限状态', e)
        result[p.scope] = 'unknown'
      }
    }
    setStatusMap(result)
  }, [permissions])

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

  const statusClass = useCallback((scope: string): string => {
    const s = statusMap[scope]
    const base = 'text-[22rpx] py-[2rpx] px-[12rpx] rounded-[6rpx] ml-auto'
    if (s === 'granted') return `${base} text-success bg-[rgba(16,185,129,0.1)]`
    if (s === 'denied') return `${base} text-destructive bg-[rgba(239,68,68,0.1)]`
    return `${base} text-muted-foreground bg-background`
  }, [statusMap])

  useDidShow(() => load())

  return (
    <View className="min-h-screen bg-background pb-[60rpx]">
      <View className="m-[24rpx] p-[24rpx] bg-[rgba(245,158,11,0.1)] rounded-[12rpx]">
        <Text className="text-[24rpx] text-[#996600] leading-[1.7]">{t('about.appPermission.intro')}</Text>
      </View>

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        {permissions.map((p, idx) => (
          <View key={p.scope} className={`flex items-center py-[28rpx] px-[32rpx] active:bg-background${idx > 0 ? ' mt-[16rpx]' : ''}`}>
            <View className="flex-1 mr-[16rpx]">
              <View className="flex items-center flex-wrap gap-[12rpx]">
                <Text className="text-[28rpx] text-foreground font-medium">{p.name}</Text>
                {p.required ? (
                  <Text className="text-[20rpx] text-white bg-[#ff6b6b] py-[2rpx] px-[12rpx] rounded-[6rpx]">{t('about.appPermission.required')}</Text>
                ) : (
                  <Text className="text-[20rpx] text-white bg-[#ccc] py-[2rpx] px-[12rpx] rounded-[6rpx]">{t('about.appPermission.optional')}</Text>
                )}
                <Text className={statusClass(p.scope)}>{statusText(p.scope)}</Text>
              </View>
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] leading-[1.6]">{p.desc}</Text>
            </View>
            <Button className="flex-shrink-0 text-[24rpx] bg-primary text-white rounded-[8rpx] px-[20rpx] leading-[56rpx] m-0 after:border-0" size="mini" onClick={onOpenSetting}>
              {tt('about.appPermission.goSetting', '去设置')}
            </Button>
          </View>
        ))}
      </View>

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        <View className="flex items-center py-[28rpx] px-[32rpx] active:bg-background" onClick={onOpenSetting}>
          <Text className="text-[28rpx] text-foreground">{tt('about.appPermission.openAllSetting', '打开系统设置')}</Text>
          <Text className="text-muted-foreground text-[32rpx] ml-auto">›</Text>
        </View>
      </View>

      <View className="text-center p-[32rpx]">
        <Text className="text-[22rpx] text-muted-foreground">{t('about.appPermission.footer')}</Text>
      </View>
    </View>
  )
}
