import { View, Text, Image, Video } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getLiveDetail, type Live } from '@/api'

export default function LiveDetail() {
  const router = useRouter()
  const [live, setLive] = useState<Live | null>(null)

  const loadDetail = useCallback(async (id: string | number) => {
    try {
      const res = await getLiveDetail(id)
      setLive(res)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }, [])

  useEffect(() => {
    const id = router.params.id || ''
    if (id) loadDetail(id)
  }, [router.params.id, loadDetail])

  const enterLive = useCallback(() => {
    Taro.showToast({ title: '正在连接直播间...', icon: 'loading' })
  }, [])

  if (!live) {
    return (
      <View className="flex items-center justify-center h-screen text-[#999]">
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen">
      {/* 播放区 */}
      <View className="w-full h-[210px] bg-black">
        {live.playUrl ? (
          <Video
            className="w-full h-full"
            src={live.playUrl}
            autoplay
            controls
            objectFit="contain"
          />
        ) : (
          <View className="relative w-full h-full">
            <Image className="w-full h-full opacity-60" src={live.coverUrl} mode="aspectFill" />
            {live.status === 'living' && (
              <View className="absolute inset-0 flex items-center justify-center">
                <View className="px-7 py-2.5 bg-[#dd524d] text-white rounded-full text-sm" onClick={enterLive}>
                  <Text>进入直播</Text>
                </View>
              </View>
            )}
            {live.status === 'ended' && (
              <View className="absolute inset-0 flex flex-col items-center justify-center text-white text-sm">
                <Text>直播已结束</Text>
              </View>
            )}
            {live.status === 'upcoming' && (
              <View className="absolute inset-0 flex flex-col items-center justify-center text-white text-sm">
                <Text>直播未开始</Text>
                {live.startTime && <Text className="mt-2 text-xs opacity-80">{live.startTime}</Text>}
              </View>
            )}
          </View>
        )}
      </View>

      {/* 直播信息 */}
      <View className="p-3">
        <Text className="text-lg text-[#333] font-semibold">{live.title}</Text>
        <View className="flex justify-between mt-2">
          {live.anchor && <Text className="text-sm text-[#007aff]">主播：{live.anchor}</Text>}
          {live.watchCount !== undefined && <Text className="text-sm text-[#999]">{live.watchCount}人观看</Text>}
        </View>
      </View>
    </View>
  )
}
