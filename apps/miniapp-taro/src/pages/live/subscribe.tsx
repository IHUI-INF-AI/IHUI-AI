import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { subscribeLive, getLiveList, type Live } from '@/api'

export default function LiveSubscribe() {
  const [list, setList] = useState<Live[]>([])
  const [subscribed, setSubscribed] = useState<Set<string | number>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await getLiveList({ status: 'upcoming' })
      setList(res.list || [])
    } catch (e) {}
  }, [])

  useDidShow(() => { load() })

  const onSubscribe = useCallback(async (id: string | number) => {
    try {
      await subscribeLive(id)
      setSubscribed(prev => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      Taro.showToast({ title: '订阅成功', icon: 'success' })
    } catch (e) {}
  }, [])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {list.length > 0 ? (
        <View className="p-[12px]">
          {list.map(l => {
            const isSubscribed = subscribed.has(l.id)
            return (
              <View key={l.id} className="flex items-center bg-white rounded-[8px] p-[12px] mb-[12px]">
                <Image
                  className="w-[80px] h-[60px] rounded-[8px] bg-[#f5f5f5]"
                  src={l.coverUrl}
                  mode="aspectFill"
                />
                <View className="flex-1 ml-[12px]">
                  <Text className="text-[15px] text-[#333] font-semibold">{l.title}</Text>
                  {l.startTime && (
                    <Text className="block text-[12px] text-[#999] mt-[4px]">{l.startTime}</Text>
                  )}
                  {l.anchor && (
                    <Text className="block text-[12px] text-[#666] mt-[2px]">{l.anchor}</Text>
                  )}
                </View>
                <Button
                  className={`ml-[8px] text-[12px] rounded-[4px] h-[30px] leading-[30px] px-[12px] ${
                    isSubscribed ? 'bg-[#f5f5f5] text-[#999]' : 'bg-[#007aff] text-white'
                  }`}
                  disabled={isSubscribed}
                  onClick={() => onSubscribe(l.id)}
                >
                  {isSubscribed ? '已订阅' : '订阅提醒'}
                </Button>
              </View>
            )
          })}
        </View>
      ) : (
        <View className="text-center py-[64px]">
          <Text className="text-[14px] text-[#999]">暂无即将开始的直播</Text>
        </View>
      )}
    </View>
  )
}
