import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getLiveCalendar, type Live } from '@/api'

interface DayGroup {
  date: string
  lives: Live[]
}

const statusMap: Record<string, { text: string; bg: string; color: string }> = {
  upcoming: { text: '预告', bg: 'bg-[#fff5e6]', color: 'text-[#ff9a3c]' },
  living: { text: '直播中', bg: 'bg-[#ffe6e6]', color: 'text-[#dd524d]' },
  ended: { text: '已结束', bg: 'bg-[#f5f5f5]', color: 'text-[#999]' },
}

export default function LiveCalendar() {
  const [list, setList] = useState<DayGroup[]>([])

  const load = useCallback(async () => {
    try {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const res = await getLiveCalendar({ month })
      setList(res.list || [])
    } catch (e) {
      console.error('[live/calendar] 获取直播日历 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }, [])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="px-[12px] py-[12px]">
        <Text className="text-[16px] text-[#333] font-semibold">
          {new Date().getMonth() + 1}月直播日历
        </Text>
      </View>
      {list.map((group) => (
        <View key={group.date} className="mb-[12px]">
          <View className="px-[12px] py-[8px]">
            <Text className="text-[14px] text-[#333] font-semibold">{group.date}</Text>
          </View>
          {group.lives.map((l) => {
            const st = statusMap[l.status] || {
              text: '已结束',
              bg: 'bg-[#f5f5f5]',
              color: 'text-[#999]',
            }
            return (
              <View
                key={l.id}
                className="mx-[12px] mb-[12px] bg-white rounded-[8px] p-[12px]"
                onClick={() => goDetail(l.id)}
              >
                <Image
                  className="w-full h-[120px] rounded-[8px] bg-[#f5f5f5]"
                  src={l.coverUrl}
                  mode="aspectFill"
                />
                <View className="mt-[8px] flex items-center justify-between">
                  <Text className="text-[15px] text-[#333] font-semibold flex-1">{l.title}</Text>
                  <View className={`ml-[8px] px-[8px] py-[2px] rounded-[4px] ${st.bg}`}>
                    <Text className={`text-[12px] ${st.color}`}>{st.text}</Text>
                  </View>
                </View>
                <View className="mt-[6px] flex items-center justify-between">
                  {l.anchor && <Text className="text-[13px] text-[#666]">{l.anchor}</Text>}
                  {l.startTime && <Text className="text-[12px] text-[#999]">{l.startTime}</Text>}
                </View>
              </View>
            )
          })}
        </View>
      ))}
      {list.length === 0 && (
        <View className="text-center py-[64px]">
          <Text className="text-[14px] text-[#999]">本月暂无直播</Text>
        </View>
      )}
    </View>
  )
}
