import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

const REQUIRED_FLAGS = [true, false, true, false, false, true]
const ALBUM_NAME_FB = '相册权限'
const ALBUM_DESC_FB = '用于保存和上传图片到相册'

export default function AppPermission() {
  const { t, tList } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const names = tList('about.appPermission.names')
  const descs = tList('about.appPermission.descs')
  const hasAlbum = names.length >= 6
  const permissionNames = hasAlbum
    ? names
    : [...names, tt('about.appPermission.albumName', ALBUM_NAME_FB)]
  const permissionDescs = hasAlbum
    ? descs
    : [...descs, tt('about.appPermission.albumDesc', ALBUM_DESC_FB)]
  const permissions = permissionNames.map((name, i) => ({
    name,
    desc: permissionDescs[i] || '',
    required: REQUIRED_FLAGS[i] ?? false,
  }))

  const onOpenSetting = useCallback(() => {
    Taro.openSetting()
  }, [])

  return (
    <View className="page">
      <View className="intro">
        <Text className="intro-text">{t('about.appPermission.intro')}</Text>
      </View>

      <View className="card">
        {permissions.map((p, idx) => (
          <View key={p.name} className={`row${idx === permissions.length - 1 ? ' last' : ''}`}>
            <View className="body">
              <View className="head">
                <Text className="name">{p.name}</Text>
                {p.required ? (
                  <Text className="tag">{t('about.appPermission.required')}</Text>
                ) : (
                  <Text className="tag opt">{t('about.appPermission.optional')}</Text>
                )}
              </View>
              <Text className="desc">{p.desc}</Text>
            </View>
            <Button className="setting-btn" size="mini" onClick={onOpenSetting}>
              {tt('about.appPermission.goSetting', '去设置')}
            </Button>
          </View>
        ))}
      </View>

      <View className="tips">
        <Text>{t('about.appPermission.footer')}</Text>
      </View>
    </View>
  )
}
