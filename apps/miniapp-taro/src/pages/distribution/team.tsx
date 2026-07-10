import { View, Text, Image } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getDistributionTeam } from '@/api'

interface TeamMember {
  id: string
  nickname: string
  avatar?: string
  joinTime: string
  level: number
}

const PAGE_SIZE = 20

export default function DistributionTeam() {
  const [list, setList] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getDistributionTeam({ page: pageRef.current, pageSize: PAGE_SIZE })
      const items = res.list || []
      setList(prev => (reset ? items : [...prev, ...items]))
      setTotal(res.total)
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch (e) {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
  }, [])

  useReachBottom(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="px-[32rpx] py-[24rpx] text-[26rpx] text-[#666]">团队总人数：{total}</View>
      {list.length > 0 && (
        <View className="px-[24rpx]">
          {list.map(m => (
            <View key={m.id} className="flex items-center bg-white p-[24rpx] mb-[24rpx] rounded-[16rpx]">
              <Image
                className="w-[80rpx] h-[80rpx] rounded-full bg-[#f5f5f5]"
                src={m.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <View className="flex-1 ml-[24rpx]">
                <Text className="block text-[28rpx] text-[#333]">{m.nickname}</Text>
                <Text className="block text-[22rpx] text-[#999] mt-[8rpx]">加入时间：{m.joinTime}</Text>
              </View>
              <Text className="text-[24rpx] text-[#ff6e3c]">L{m.level}</Text>
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[120rpx] text-[#999]">
          <Text>暂无团队成员</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[120rpx] text-[#999]">
          <Text>加载中...</Text>
        </View>
      )}
    </View>
  )
}
