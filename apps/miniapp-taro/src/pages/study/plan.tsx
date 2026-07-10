import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyPlan } from '@/api'

interface PlanItem {
  id: string
  title: string
  target: number
  progress: number
}

export default function StudyPlan() {
  const [list, setList] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getStudyPlan()
      setList(res.list || [])
    } catch {
      // 统一提示
    } finally {
      setLoading(false)
    }
  }, [])

  const onAdd = useCallback(() => {
    Taro.showToast({ title: '功能开发中', icon: 'none' })
  }, [])

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[60px]">
      {list.length > 0 && (
        <View className="p-3">
          {list.map(p => (
            <View key={p.id} className="bg-white rounded-2xl p-3 mb-3">
              <View className="flex justify-between items-center">
                <Text className="text-sm text-[#333] font-semibold">{p.title}</Text>
                <Text className="text-xs text-[#999]">目标{p.target}%</Text>
              </View>
              <View className="h-1.5 bg-[#f5f5f5] rounded mt-2">
                <View
                  className="h-full bg-[#007aff] rounded"
                  style={{ width: `${p.progress}%` }}
                />
              </View>
              <View className="flex justify-between mt-1.5">
                <Text className="text-xs text-[#999]">已完成 {p.progress}%</Text>
                <Text className={`text-xs ${p.progress >= p.target ? 'text-[#4caf50]' : 'text-[#ff9a3c]'}`}>
                  {p.progress >= p.target ? '已完成' : '进行中'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999]">
          <Text>暂无学习计划</Text>
        </View>
      )}
      <Button
        className="fixed bottom-4 left-4 right-4 bg-[#007aff] text-white rounded-full text-sm"
        onClick={onAdd}
      >
        + 新建计划
      </Button>
    </View>
  )
}
