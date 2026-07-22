import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getBusinessCard } from '@/api'
import { showShareMenu, getShareInfo } from '@/utils/share'
import { saveNetworkImageToAlbum } from '@/utils/save-album'
import { useI18n } from '@/i18n'

interface CardInfo {
  name?: string
  nickname?: string
  avatar?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  qrcode?: string
  intro?: string
}

export default function CartePage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<CardInfo>({})

  const load = useCallback(async () => {
    try {
      const res = (await getBusinessCard()) as CardInfo
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
    Taro.showToast({ title: t('carte.shareHint'), icon: 'none' })
  }

  const handleSaveQrcode = async () => {
    if (!info.qrcode) {
      Taro.showToast({ title: t('carte.noQrcode'), icon: 'none' })
      return
    }
    try {
      await saveNetworkImageToAlbum(info.qrcode)
    } catch {
      // ignore
    }
  }

  const handleCopyPhone = () => {
    if (!info.phone) return
    Taro.setClipboardData({ data: info.phone })
  }

  const displayName = info.name || info.nickname || t('carte.anonymous')
  const shareInfo = getShareInfo('/pages/carte/index', `${displayName}${t('carte.cardSuffix')}`)

  return (
    <View className="min-h-screen bg-background">
      <View className="bg-gradient-to-b from-[#0f766e] to-[#14b8a6] px-6 pt-12 pb-8 text-white text-center">
        <View className="flex justify-center mb-4">
          {info.avatar ? (
            <Image
              className="w-20 h-20 rounded-2xl border-2 border-white/30"
              src={info.avatar}
              mode="aspectFill"
            />
          ) : (
            <View className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20">
              <Text className="text-2xl font-medium">{displayName.charAt(0)}</Text>
            </View>
          )}
        </View>
        <Text className="block text-xl font-bold">{displayName}</Text>
        {info.title && <Text className="block text-sm opacity-80 mt-1">{info.title}</Text>}
        {info.company && <Text className="block text-xs opacity-70 mt-1">{info.company}</Text>}
      </View>

      <View className="mx-3 mt-4 bg-card rounded-xl p-4">
        {info.intro && (
          <View className="mb-4 pb-3 border-b border-border">
            <Text className="block text-xs text-muted-foreground mb-1">{t('carte.introLabel')}</Text>
            <Text className="block text-sm text-foreground leading-relaxed">{info.intro}</Text>
          </View>
        )}

        {info.phone && (
          <View
            className="flex items-center justify-between py-2.5 border-b border-border"
            onClick={handleCopyPhone}
          >
            <Text className="text-sm text-muted-foreground">{t('carte.phone')}</Text>
            <Text className="text-sm text-foreground">{info.phone}</Text>
          </View>
        )}
        {info.email && (
          <View className="flex items-center justify-between py-2.5 border-b border-border">
            <Text className="text-sm text-muted-foreground">{t('carte.email')}</Text>
            <Text className="text-sm text-foreground">{info.email}</Text>
          </View>
        )}

        <View className="flex flex-col items-center mt-4">
          {info.qrcode ? (
            <Image className="w-36 h-36 rounded-lg" src={info.qrcode} mode="aspectFit" />
          ) : (
            <View className="flex items-center justify-center w-36 h-36 rounded-lg bg-muted">
              <Text className="text-xs text-muted-foreground">{t('carte.noQrcode')}</Text>
            </View>
          )}
          <Text className="block text-xs text-muted-foreground mt-2">{t('carte.scanHint')}</Text>
        </View>
      </View>

      <View className="mx-3 mt-3 flex gap-2">
        <Button className="flex-1 text-sm rounded-lg bg-secondary text-white" onClick={handleShare}>
          {t('carte.shareCard')}
        </Button>
        <Button
          className="flex-1 text-sm rounded-lg bg-muted text-foreground"
          onClick={handleSaveQrcode}
        >
          {t('carte.saveQrcode')}
        </Button>
      </View>

      <View className="mx-3 mt-3 mb-6">
        <Text className="block text-xs text-muted-foreground text-center break-all">{shareInfo.path}</Text>
      </View>
    </View>
  )
}
