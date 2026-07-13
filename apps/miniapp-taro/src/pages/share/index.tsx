import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getKnowledgePlanetInfo } from '@/api'
import { getShareInfo, showShareMenu } from '@/utils/share'
import { saveNetworkImageToAlbum } from '@/utils/save-album'
import { NavBar } from '@/components'

interface PlanetInfo {
  name?: string
  desc?: string
  coverUrl?: string
  memberCount?: number
  inviteCode?: string
}

export default function SharePage() {
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
    Taro.showToast({ title: '点击右上角分享', icon: 'none' })
  }

  const handleSaveImage = async () => {
    if (!info.coverUrl) {
      Taro.showToast({ title: '暂无图片', icon: 'none' })
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
      <NavBar title="分享星球" showBack />
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
        <Text className="block text-xl font-bold">{info.name || '智汇AI星球'}</Text>
        <Text className="block text-sm opacity-80 mt-2 px-6">
          {info.desc || '加入星球，与AI一起成长'}
        </Text>
        {info.memberCount !== undefined && (
          <Text className="block text-xs opacity-70 mt-3">{info.memberCount} 人已加入</Text>
        )}
      </View>

      <View className="mx-3 mt-4 bg-white rounded-xl p-4">
        <Text className="block text-sm font-medium text-gray-800 mb-3">分享给好友</Text>
        <View className="flex items-center justify-center my-4">
          <View className="w-40 h-40 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
            <Text className="text-xs text-gray-400">分享二维码</Text>
          </View>
        </View>
        <Text className="block text-xs text-gray-400 text-center mb-4">扫描二维码加入星球</Text>
        <View className="flex gap-2">
          <Button
            className="flex-1 text-sm rounded-lg bg-gray-800 text-white"
            onClick={handleShare}
          >
            分享好友
          </Button>
          <Button
            className="flex-1 text-sm rounded-lg bg-gray-100 text-gray-700"
            onClick={handleSaveImage}
          >
            保存图片
          </Button>
        </View>
      </View>

      <View className="mx-3 mt-3 bg-white rounded-xl p-4">
        <Text className="block text-sm font-medium text-gray-800 mb-2">分享路径</Text>
        <Text className="block text-xs text-gray-400 break-all">{shareInfo.path}</Text>
      </View>
    </View>
  )
}
