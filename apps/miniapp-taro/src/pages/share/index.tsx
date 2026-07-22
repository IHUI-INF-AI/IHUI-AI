import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getKnowledgePlanetInfo } from '@/api'
import { getShareInfo, showShareMenu } from '@/utils/share'
import { saveNetworkImageToAlbum } from '@/utils/save-album'
import { NavBar } from '@/components'
import { useI18n } from '@/i18n'

interface PlanetInfo {
  name?: string
  desc?: string
  coverUrl?: string
  memberCount?: number
  inviteCode?: string
}

export default function SharePage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<PlanetInfo>({})

  const load = useCallback(async () => {
    try {
      const res = (await getKnowledgePlanetInfo()) as PlanetInfo
      setInfo(res)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
    showShareMenu()
  })

  const handleShare = () => {
    Taro.showShareMenu({ withShareTicket: true })
    Taro.showToast({ title: t('share.shareHint'), icon: 'none' })
  }

  const handleSaveImage = async () => {
    if (!info.coverUrl) {
      Taro.showToast({ title: t('share.noImage'), icon: 'none' })
      return
    }
    try {
      await saveNetworkImageToAlbum(info.coverUrl)
    } catch {
      // 错误已在工具内处理
    }
  }

  const shareInfo = getShareInfo('/pages/share/index', info.name)

  return (
    <View className="min-h-screen bg-background">
      <NavBar title={t('share.navTitle')} showBack />
      <View className="bg-gradient-to-b from-[#6366f1] to-[#818cf8] px-4 pt-10 pb-8 text-white text-center">
        <View className="flex justify-center mb-4">
          {info.coverUrl ? (
            <Image className="w-20 h-20 rounded-2xl" src={info.coverUrl} mode="aspectFill" />
          ) : (
            <View className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20">
              <Text className="text-3xl">🌟</Text>
            </View>
          )}
        </View>
        <Text className="block text-xl font-bold">{info.name || t('share.defaultName')}</Text>
        <Text className="block text-sm opacity-80 mt-2 px-6">
          {info.desc || t('share.defaultDesc')}
        </Text>
        {info.memberCount !== undefined && (
          <Text className="block text-xs opacity-70 mt-3">
            {t('share.memberCount', { n: info.memberCount })}
          </Text>
        )}
      </View>

      <View className="mx-3 mt-4 bg-card rounded-xl p-4">
        <Text className="block text-sm font-medium text-foreground mb-3">
          {t('share.shareToFriends')}
        </Text>
        <View className="flex items-center justify-center my-4">
          <View className="w-40 h-40 bg-muted rounded-lg flex items-center justify-center border border-border">
            <Text className="text-xs text-muted-foreground">{t('share.qrcode')}</Text>
          </View>
        </View>
        <Text className="block text-xs text-muted-foreground text-center mb-4">{t('share.scanHint')}</Text>
        <View className="flex gap-2">
          <Button
            className="flex-1 text-sm rounded-lg bg-secondary text-white"
            onClick={handleShare}
          >
            {t('share.shareFriend')}
          </Button>
          <Button
            className="flex-1 text-sm rounded-lg bg-muted text-foreground"
            onClick={handleSaveImage}
          >
            {t('share.saveImage')}
          </Button>
        </View>
      </View>

      <View className="mx-3 mt-3 bg-card rounded-xl p-4">
        <Text className="block text-sm font-medium text-foreground mb-2">{t('share.sharePath')}</Text>
        <Text className="block text-xs text-muted-foreground break-all">{shareInfo.path}</Text>
      </View>
    </View>
  )
}
