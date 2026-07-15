import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getCourseList, type Course } from '@/api'

export default function CourseList() {
  const [list, setList] = useState<Course[]>([])
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
      const res = await getCourseList({
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
    Taro.navigateTo({ url: `/pages/course/detail?id=${id}` })
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
      {/* 搜索栏 */}
      <View className="flex items-center mb-3">
        <Input
          className="flex-1 h-9 px-3 bg-white rounded-full text-sm"
          type="text"
          placeholder="搜索课程"
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={onSearch}
        />
        <View className="ml-2 px-3 h-9 leading-9 text-[#07c160] text-sm" onClick={onSearch}>
          <Text>搜索</Text>
        </View>
      </View>

      {/* 课程列表 */}
      {list.length > 0 && (
        <View>
          {list.map((item) => (
            <View
              key={item.id}
              className="flex bg-white rounded-2xl overflow-hidden mb-3"
              onClick={() => goDetail(item.id)}
            >
              <Image
                className="w-[110px] h-[80px] flex-shrink-0"
                src={item.coverUrl}
                mode="aspectFill"
              />
              <View className="flex-1 p-2 flex flex-col justify-between">
                <Text className="text-[15px] text-[#333] font-semibold">{item.title}</Text>
                {item.subtitle && <Text className="text-xs text-[#999] mt-1">{item.subtitle}</Text>}
                <View className="flex justify-between items-center mt-2">
                  {item.teacher && <Text className="text-xs text-[#666]">{item.teacher}</Text>}
                  <Text className="text-base text-[#dd524d] font-semibold">¥{item.price ?? 0}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-[#999] text-sm">
          <Text>暂无课程</Text>
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
