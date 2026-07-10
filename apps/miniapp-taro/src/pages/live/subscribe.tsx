import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { type Live } from '@/api'

export default function LiveSubscribe() {
  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)

  const statusText = useCallback((s: string) => {
    return ({ upcoming: '未开始', living: '直播中', ended: '已结束' } as Record<string, string>)[s] || ''
  }, [])

  const load = useCallback(async () => {
    try {
      setList(list)
    } finally {
      setLoading(false)
    }
  }, [list])

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {list.length > 0 && (
        <View className="p-3">
          {list.map(l => (
            <View key={l.id} className="flex items-center bg-white rounded-2xl p-3 mb-3">
              <Image className="w-[60px] h-[40px] rounded bg-[#f5f5f5]" src={l.coverUrl} mode="aspectFill" />
              <View className="flex-1 ml-3">
                <Text className="text-sm text-[#333] font-semibold">{l.title}</Text>
                {l.startTime && <Text className="block text-xs text-[#999] mt-1">{l.startTime}</Text>}
              </View>
              <View
                className={`px-2 py-1 rounded ${
                  l.status === 'upcoming' ? 'bg-[#fff5e6]' :
                  l.status === 'living' ? 'bg-[#ffe6e6]' : 'bg-[#f5f5f5]'
                }`}
              >
                <Text
                  className={`text-xs ${
                    l.status === 'upcoming' ? 'text-[#ff9a3c]' :
                    l.status === 'living' ? 'text-[#dd524d]' : 'text-[#999]'
                  }`}
                >
                  {statusText(l.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999]">
          <Text>暂无订阅</Text>
        </View>
      )}
    </View>
  )
}
