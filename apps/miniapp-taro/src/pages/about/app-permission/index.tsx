import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

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
    if (s === 'granted') return 'status status-granted'
    if (s === 'denied') return 'status status-denied'
    return 'status status-unknown'
  }, [statusMap])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="intro">
        <Text className="intro-text">{t('about.appPermission.intro')}</Text>
      </View>

      <View className="card">
        {permissions.map((p, idx) => (
          <View key={p.scope} className={`row${idx === permissions.length - 1 ? ' last' : ''}`}>
            <View className="body">
              <View className="head">
                <Text className="name">{p.name}</Text>
                {p.required ? (
                  <Text className="tag required">{t('about.appPermission.required')}</Text>
                ) : (
                  <Text className="tag opt">{t('about.appPermission.optional')}</Text>
                )}
                <Text className={statusClass(p.scope)}>{statusText(p.scope)}</Text>
              </View>
              <Text className="desc">{p.desc}</Text>
            </View>
            <Button className="setting-btn" size="mini" onClick={onOpenSetting}>
              {tt('about.appPermission.goSetting', '去设置')}
            </Button>
          </View>
        ))}
      </View>

      <View className="card">
        <View className="row last" onClick={onOpenSetting}>
          <Text className="label">{tt('about.appPermission.openAllSetting', '打开系统设置')}</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>

      <View className="tips">
        <Text>{t('about.appPermission.footer')}</Text>
      </View>
    </View>
  )
}
