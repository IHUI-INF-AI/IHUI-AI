import { View, Text, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getLiveList, type Live } from '@/api'

export default function LiveList() {
  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const statusRef = useRef('')

  const statusText = useCallback((s: Live['status']) => {
    return s === 'living' ? '直播中' : s === 'upcoming' ? '预告' : '回放'
  }, [])

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
      const res = await getLiveList({ page: pageRef.current, pageSize: 10, status: statusRef.current })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList(prev => reset ? more : [...prev, ...more])
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
    } catch {
      // 统一提示
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const switchStatus = useCallback((s: string) => {
    statusRef.current = s
    setStatus(s)
    load(true)
  }, [load])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }, [])

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })
  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [load])

  return (
    <View className="min-h-screen p-3">
      {/* 状态筛选 */}
      <View className="flex mb-3 bg-white rounded-xl">
        {[
          { key: '', label: '全部' },
          { key: 'living', label: '直播中' },
          { key: 'upcoming', label: '预告' },
          { key: 'ended', label: '回放' },
        ].map(tab => (
          <View
            key={tab.key}
            className={`flex-1 text-center py-2.5 text-sm ${status === tab.key ? 'text-[#007aff] font-semibold' : 'text-[#666]'}`}
            onClick={() => switchStatus(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      {/* 直播列表 */}
      {list.length > 0 && (
        <View>
          {list.map(item => (
            <View
              key={item.id}
              className="bg-white rounded-2xl overflow-hidden mb-3"
              onClick={() => goDetail(item.id)}
            >
              <View className="relative w-full h-[160px]">
                <Image className="w-full h-full" src={item.coverUrl} mode="aspectFill" />
                <View
                  className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-xs ${
                    item.status === 'living' ? 'bg-[#dd524d] text-white' :
                    item.status === 'upcoming' ? 'bg-[#f0ad4e] text-white' :
                    'bg-black/50 text-white'
                  }`}
                >
                  <Text>{statusText(item.status)}</Text>
                </View>
              </View>
              <View className="p-2.5">
                <Text className="text-base text-[#333] font-semibold">{item.title}</Text>
                <View className="flex justify-between mt-1.5">
                  {item.anchor && <Text className="text-xs text-[#007aff]">{item.anchor}</Text>}
                  {item.startTime && <Text className="text-xs text-[#999]">{item.startTime}</Text>}
                </View>
                {item.watchCount !== undefined && (
                  <Text className="block mt-1 text-xs text-[#999]">{item.watchCount}人观看</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999] text-sm">
          <Text>暂无直播</Text>
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
