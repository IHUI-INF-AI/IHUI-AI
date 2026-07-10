import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getExamList, type Exam } from '@/api'

export default function ExamList() {
  const [list, setList] = useState<Exam[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)

  const statusText = useCallback((s?: string) => {
    return ({ pending: '待考', done: '已完成', expired: '已过期' } as Record<string, string>)[s || ''] || '待考'
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
      const res = await getExamList({ page: pageRef.current, pageSize: 20 })
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

  const switchTab = useCallback((s: string) => {
    setStatus(s)
    load(true)
  }, [load])

  const goDetail = useCallback((e: Exam) => {
    if (e.status === 'done') {
      Taro.navigateTo({ url: `/pages/exam/result?id=${e.id}` })
    } else {
      Taro.navigateTo({ url: `/pages/exam/detail?id=${e.id}` })
    }
  }, [])

  useDidShow(() => {
    load(true)
  })
  useReachBottom(() => load())

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {/* 状态筛选 */}
      <View className="flex bg-white">
        {[
          { key: '', label: '全部' },
          { key: 'pending', label: '待考试' },
          { key: 'done', label: '已完成' },
        ].map(tab => (
          <View
            key={tab.key}
            className={`flex-1 text-center text-sm py-3 ${status === tab.key ? 'text-[#007aff] font-semibold' : 'text-[#666]'}`}
            onClick={() => switchTab(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      {list.length > 0 && (
        <View className="p-3">
          {list.map(e => (
            <View
              key={e.id}
              className="bg-white rounded-2xl p-4 mb-3"
              onClick={() => goDetail(e)}
            >
              <View className="flex justify-between items-center">
                <Text className="text-base text-[#333] font-semibold">{e.title}</Text>
                <Text
                  className={`text-xs ${
                    e.status === 'pending' ? 'text-[#ff9a3c]' :
                    e.status === 'done' ? 'text-[#4caf50]' : 'text-[#999]'
                  }`}
                >
                  {statusText(e.status)}
                </Text>
              </View>
              <View className="flex gap-3 mt-2">
                <Text className="text-xs text-[#666]">{e.questions}题</Text>
                <Text className="text-xs text-[#666]">{e.duration}分钟</Text>
                <Text className="text-xs text-[#666]">及格{e.passScore}分</Text>
              </View>
              {e.startTime && (
                <Text className="block text-xs text-[#999] mt-1.5">时间：{e.startTime} - {e.endTime}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999]">
          <Text>暂无考试</Text>
        </View>
      )}
    </View>
  )
}
