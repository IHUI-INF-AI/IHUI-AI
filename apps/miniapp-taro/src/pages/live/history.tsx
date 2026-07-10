import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getLiveHistory, type Live } from '@/api'

export default function LiveHistory() {
  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      lenRef.current = 0
      setList([])
    }
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getLiveHistory({ page: pageRef.current, pageSize: 10 })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList(prev => reset ? more : [...prev, ...more])
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
    } catch (e) {
      // 统一提示
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }, [])

  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [load])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {list.length > 0 && (
        <View className="p-3">
          {list.map(l => (
            <View
              key={l.id}
              className="flex bg-white rounded-2xl overflow-hidden mb-3"
              onClick={() => goDetail(l.id)}
            >
              <Image className="w-[120px] h-[80px] flex-shrink-0 bg-[#f5f5f5]" src={l.coverUrl} mode="aspectFill" />
              <View className="flex-1 p-2.5 flex flex-col justify-between">
                <Text className="text-sm text-[#333] font-semibold">{l.title}</Text>
                {l.anchor && <Text className="text-xs text-[#666]">主播：{l.anchor}</Text>}
                <View className="flex justify-between">
                  <Text className="text-xs text-[#999]">{l.startTime}</Text>
                  <Text className="text-xs text-[#007aff]">回放</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999] text-sm">
          <Text>暂无直播回放</Text>
        </View>
      )}

      {loading && (
        <View className="text-center py-16 text-[#999] text-sm">
          <Text>加载中...</Text>
        </View>
      )}
    </View>
  )
}
