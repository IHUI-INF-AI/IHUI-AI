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
    <View className="min-h-screen bg-[#f7f8fa]">
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

      <View className="mx-3 mt-4 bg-white rounded-xl p-4">
        <Text className="block text-sm font-medium text-gray-800 mb-3">
          {t('share.shareToFriends')}
        </Text>
        <View className="flex items-center justify-center my-4">
          <View className="w-40 h-40 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
            <Text className="text-xs text-gray-400">{t('share.qrcode')}</Text>
          </View>
        </View>
        <Text className="block text-xs text-gray-400 text-center mb-4">{t('share.scanHint')}</Text>
        <View className="flex gap-2">
          <Button
            className="flex-1 text-sm rounded-lg bg-gray-800 text-white"
            onClick={handleShare}
          >
            {t('share.shareFriend')}
          </Button>
          <Button
            className="flex-1 text-sm rounded-lg bg-gray-100 text-gray-700"
            onClick={handleSaveImage}
          >
            {t('share.saveImage')}
          </Button>
        </View>
      </View>

      <View className="mx-3 mt-3 bg-white rounded-xl p-4">
        <Text className="block text-sm font-medium text-gray-800 mb-2">{t('share.sharePath')}</Text>
        <Text className="block text-xs text-gray-400 break-all">{shareInfo.path}</Text>
      </View>
    </View>
  )
}
