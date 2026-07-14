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
      const items = (res.list || []).map((u): TeamMember => ({
        id: u.id,
        nickname: u.nickname || u.username,
        avatar: u.avatar ?? undefined,
        joinTime: u.createdAt,
        level: 1,
      }))
      setList((prev) => (reset ? items : [...prev, ...items]))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
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
      {list.length > 0 && (
        <View className="p-[12px]">
          {list.map((m) => (
            <View
              key={m.id}
              className="flex items-center bg-white p-[12px] mb-[12px] rounded-[8px]"
            >
              <Image
                className="w-[40px] h-[40px] rounded-full bg-[#f5f5f5]"
                src={m.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <View className="flex-1 ml-[12px]">
                <Text className="block text-[14px] text-[#333]">{m.nickname}</Text>
                <Text className="block text-[12px] text-[#999] mt-[4px]">
                  加入时间：{m.joinTime}
                </Text>
              </View>
              <Text className="text-[14px] text-[#ff6b35] font-semibold">V{m.level}</Text>
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[60px] text-[#999]">
          <Text>暂无团队成员</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[20px] text-[#999]">
          <Text>加载中...</Text>
        </View>
      )}
    </View>
  )
}
