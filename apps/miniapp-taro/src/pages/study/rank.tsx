import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyRank } from '@/api'

interface RankUser {
  id: string
  nickname: string
  avatar?: string
  minutes: number
}

export default function StudyRank() {
  const [list, setList] = useState<RankUser[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getStudyRank()
      setList(res.list || [])
    } catch {
      // 统一提示
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="p-6 text-center bg-gradient-to-br from-[#07c160] to-[#35e683]">
        <Text className="block text-white text-lg font-bold">学习排行榜</Text>
        <Text className="block text-white/90 text-xs mt-1">本周学习时长排名</Text>
      </View>

      {list.length >= 3 && (
        <View className="flex items-end justify-center py-4 bg-white">
          {/* 第2名 */}
          <View className="flex flex-col items-center mx-2 relative">
            <Image
              className="w-[55px] h-[55px] rounded-full bg-[#f5f5f5] border-2 border-[#c0c0c0]"
              src={list[1]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-xs text-[#333] mt-1">{list[1]!.nickname}</Text>
            <Text className="text-xs text-[#07c160] mt-0.5">{list[1]!.minutes}分钟</Text>
            <Text className="absolute -top-2 w-5 h-5 leading-5 text-center rounded-full text-white text-xs bg-[#c0c0c0]">
              2
            </Text>
          </View>
          {/* 第1名 */}
          <View className="flex flex-col items-center mx-2 relative">
            <Image
              className="w-[70px] h-[70px] rounded-full bg-[#f5f5f5] border-2 border-[#ffd700]"
              src={list[0]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-xs text-[#333] mt-1">{list[0]!.nickname}</Text>
            <Text className="text-xs text-[#07c160] mt-0.5">{list[0]!.minutes}分钟</Text>
            <Text className="absolute -top-2 w-5 h-5 leading-5 text-center rounded-full text-white text-xs bg-[#ffd700]">
              1
            </Text>
          </View>
          {/* 第3名 */}
          <View className="flex flex-col items-center mx-2 relative">
            <Image
              className="w-[55px] h-[55px] rounded-full bg-[#f5f5f5] border-2 border-[#cd7f32]"
              src={list[2]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-xs text-[#333] mt-1">{list[2]!.nickname}</Text>
            <Text className="text-xs text-[#07c160] mt-0.5">{list[2]!.minutes}分钟</Text>
            <Text className="absolute -top-2 w-5 h-5 leading-5 text-center rounded-full text-white text-xs bg-[#cd7f32]">
              3
            </Text>
          </View>
        </View>
      )}

      {list.length > 3 && (
        <View className="m-3 bg-white rounded-2xl overflow-hidden">
          {list.slice(3).map((u, i) => (
            <View
              key={u.id}
              className="flex items-center p-3 border-b border-[#f5f5f5] last:border-b-0"
            >
              <Text className="w-8 text-sm text-[#999]">{i + 4}</Text>
              <Image
                className="w-[30px] h-[30px] rounded-full bg-[#f5f5f5]"
                src={u.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="flex-1 ml-3 text-sm text-[#333]">{u.nickname}</Text>
              <Text className="text-sm text-[#07c160] font-semibold">{u.minutes}分钟</Text>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999]">
          <Text>暂无排行数据</Text>
        </View>
      )}
    </View>
  )
}
