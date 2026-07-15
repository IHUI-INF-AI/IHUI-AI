import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getTeacherList, type Teacher } from '@/api'

export default function TeacherList() {
  const [list, setList] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const keywordRef = useRef('')

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
      const res = await getTeacherList({
        page: pageRef.current,
        pageSize: 10,
        keyword: keywordRef.current,
      })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
    } catch {
      // 统一提示
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const onSearch = useCallback(() => {
    keywordRef.current = keyword
    load(true)
  }, [keyword, load])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/teacher/detail?id=${id}` })
  }, [])

  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [load])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="p-3">
        <Input
          className="h-9 px-3 bg-white rounded-full text-sm"
          placeholder="搜索讲师"
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={onSearch}
        />
      </View>
      {list.length > 0 && (
        <View className="px-3">
          {list.map((t) => (
            <View
              key={t.id}
              className="flex bg-white rounded-2xl p-3 mb-3"
              onClick={() => goDetail(t.id)}
            >
              <Image
                className="w-[60px] h-[60px] rounded-full bg-[#f5f5f5] flex-shrink-0"
                src={t.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <View className="flex-1 ml-3">
                <View className="flex items-center gap-2">
                  <Text className="text-base text-[#333] font-semibold">{t.name}</Text>
                  {t.title && (
                    <Text className="text-xs text-[#07c160] bg-[#e6f0ff] px-1.5 py-0.5 rounded">
                      {t.title}
                    </Text>
                  )}
                </View>
                <Text className="block text-xs text-[#999] mt-1.5 leading-relaxed">{t.intro}</Text>
                <View className="flex gap-3 mt-1.5">
                  <Text className="text-xs text-[#666]">{t.courses || 0}课程</Text>
                  <Text className="text-xs text-[#666]">{t.students || 0}学员</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999] text-sm">
          <Text>暂无讲师</Text>
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
