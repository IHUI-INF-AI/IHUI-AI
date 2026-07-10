import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getCourseDetail, type Course } from '@/api'

export default function CourseDetail() {
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)

  const loadDetail = useCallback(async (id: string | number) => {
    try {
      const res = await getCourseDetail(id)
      setCourse(res)
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }, [])

  useEffect(() => {
    const id = router.params.id || ''
    if (id) loadDetail(id)
  }, [router.params.id, loadDetail])

  const handleBuy = useCallback(() => {
    Taro.showToast({ title: '购买功能开发中', icon: 'none' })
  }, [])

  if (!course) {
    return (
      <View className="flex items-center justify-center h-screen text-[#999]">
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen pb-[70px]">
      {/* 课程封面 */}
      <View className="relative w-full h-[200px]">
        <Image className="w-full h-full" src={course.coverUrl} mode="aspectFill" />
        <View className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <Text className="block text-white text-lg font-bold">{course.title}</Text>
          {course.subtitle && <Text className="block mt-1 text-white/80 text-sm">{course.subtitle}</Text>}
        </View>
      </View>

      {/* 课程信息 */}
      <View className="flex p-4 bg-white">
        {course.teacher && (
          <View className="flex-1 text-center">
            <Text className="block text-xs text-[#999]">讲师</Text>
            <Text className="block mt-1 text-sm text-[#333]">{course.teacher}</Text>
          </View>
        )}
        {course.duration && (
          <View className="flex-1 text-center">
            <Text className="block text-xs text-[#999]">时长</Text>
            <Text className="block mt-1 text-sm text-[#333]">{course.duration}</Text>
          </View>
        )}
        {course.level && (
          <View className="flex-1 text-center">
            <Text className="block text-xs text-[#999]">难度</Text>
            <Text className="block mt-1 text-sm text-[#333]">{course.level}</Text>
          </View>
        )}
      </View>

      {/* 课程简介 */}
      <View className="m-3 p-3 bg-white rounded-2xl">
        <Text className="block text-base font-semibold text-[#333] mb-2">课程简介</Text>
        <Text className="text-sm text-[#666] leading-relaxed">{course.description || '暂无简介'}</Text>
      </View>

      {/* 课程大纲 */}
      {course.outline && course.outline.length > 0 && (
        <View className="m-3 p-3 bg-white rounded-2xl">
          <Text className="block text-base font-semibold text-[#333] mb-2">课程大纲</Text>
          {course.outline.map((item, idx) => (
            <View key={idx} className="py-2 border-b border-[#f5f5f5] last:border-b-0">
              <View className="flex justify-between">
                <Text className="text-sm text-[#333]">{item.title}</Text>
                <Text className="text-xs text-[#999]">{item.duration}</Text>
              </View>
              <Text className="block mt-1 text-xs text-[#999]">{item.description}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 底部操作栏 */}
      <View className="fixed left-0 right-0 bottom-0 h-[60px] bg-white flex items-center px-4 shadow-[0_-2rpx_12rpx_rgba(0,0,0,0.06)]">
        <View className="flex-1">
          <Text className="text-sm text-[#dd524d]">¥</Text>
          <Text className="text-2xl text-[#dd524d] font-bold">{course.price ?? 0}</Text>
        </View>
        <View
          className="px-7 h-10 leading-10 bg-[#007aff] text-white rounded-full text-sm"
          onClick={handleBuy}
        >
          <Text>立即购买</Text>
        </View>
      </View>
    </View>
  )
}
