import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getBusinessCard } from '@/api'
import { showShareMenu, getShareInfo } from '@/utils/share'
import { saveNetworkImageToAlbum } from '@/utils/save-album'

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
    Taro.showToast({ title: '点击右上角分享', icon: 'none' })
  }

  const handleSaveQrcode = async () => {
    if (!info.qrcode) {
      Taro.showToast({ title: '暂无二维码', icon: 'none' })
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

  const displayName = info.name || info.nickname || '匿名用户'
  const shareInfo = getShareInfo('/pages/carte/index', `${displayName}的名片`)

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="bg-gradient-to-b from-[#0f766e] to-[#14b8a6] px-6 pt-12 pb-8 text-white text-center">
        <View className="flex justify-center mb-4">
          {info.avatar ? (
            <Image
              className="w-20 h-20 rounded-full border-2 border-white/30"
              src={info.avatar}
              mode="aspectFill"
            />
          ) : (
            <View className="flex items-center justify-center w-20 h-20 rounded-full bg-white/20">
              <Text className="text-2xl font-medium">{displayName.charAt(0)}</Text>
            </View>
          )}
        </View>
        <Text className="block text-xl font-bold">{displayName}</Text>
        {info.title && <Text className="block text-sm opacity-80 mt-1">{info.title}</Text>}
        {info.company && <Text className="block text-xs opacity-70 mt-1">{info.company}</Text>}
      </View>

      <View className="mx-3 mt-4 bg-white rounded-xl p-4">
        {info.intro && (
          <View className="mb-4 pb-3 border-b border-gray-50">
            <Text className="block text-xs text-gray-400 mb-1">个人简介</Text>
            <Text className="block text-sm text-gray-600 leading-relaxed">{info.intro}</Text>
          </View>
        )}

        {info.phone && (
          <View
            className="flex items-center justify-between py-2.5 border-b border-gray-50"
            onClick={handleCopyPhone}
          >
            <Text className="text-sm text-gray-500">手机</Text>
            <Text className="text-sm text-gray-700">{info.phone}</Text>
          </View>
        )}
        {info.email && (
          <View className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <Text className="text-sm text-gray-500">邮箱</Text>
            <Text className="text-sm text-gray-700">{info.email}</Text>
          </View>
        )}

        <View className="flex flex-col items-center mt-4">
          {info.qrcode ? (
            <Image className="w-36 h-36 rounded-lg" src={info.qrcode} mode="aspectFit" />
          ) : (
            <View className="flex items-center justify-center w-36 h-36 rounded-lg bg-gray-50">
              <Text className="text-xs text-gray-400">暂无二维码</Text>
            </View>
          )}
          <Text className="block text-xs text-gray-400 mt-2">扫一扫，加我好友</Text>
        </View>
      </View>

      <View className="mx-3 mt-3 flex gap-2">
        <Button className="flex-1 text-sm rounded-lg bg-gray-800 text-white" onClick={handleShare}>
          分享名片
        </Button>
        <Button
          className="flex-1 text-sm rounded-lg bg-gray-100 text-gray-700"
          onClick={handleSaveQrcode}
        >
          保存二维码
        </Button>
      </View>

      <View className="mx-3 mt-3 mb-6">
        <Text className="block text-xs text-gray-300 text-center break-all">{shareInfo.path}</Text>
      </View>
    </View>
  )
}
