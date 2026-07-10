import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getTeacherDetail, type Teacher } from '@/api'

export default function TeacherDetail() {
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher>({} as Teacher)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    getTeacherDetail(id)
      .then(res => setTeacher(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router.params.id])

  const onFollow = useCallback(() => {
    Taro.showToast({ title: '关注成功', icon: 'success' })
  }, [])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {teacher.name && (
        <View className="flex items-center p-4 bg-white">
          <Image
            className="w-[70px] h-[70px] rounded-full bg-[#f5f5f5]"
            src={teacher.avatar || '/static/default-avatar.png'}
            mode="aspectFill"
          />
          <View className="flex-1 ml-3">
            <View className="flex items-center gap-2">
              <Text className="text-lg text-[#333] font-bold">{teacher.name}</Text>
              {teacher.title && (
                <Text className="text-xs text-[#007aff] bg-[#e6f0ff] px-1.5 py-0.5 rounded">{teacher.title}</Text>
              )}
            </View>
            <View className="flex gap-3 mt-2">
              <Text className="text-xs text-[#666]">{teacher.courses || 0}课程</Text>
              <Text className="text-xs text-[#666]">{teacher.students || 0}学员</Text>
            </View>
          </View>
          <Button size="mini" className="bg-[#007aff] text-white text-xs" onClick={onFollow}>关注</Button>
        </View>
      )}
      {teacher.intro && (
        <View className="m-3 p-4 bg-white rounded-2xl">
          <Text className="text-sm text-[#333] font-semibold mb-3 block">讲师简介</Text>
          <Text className="text-sm text-[#666] leading-relaxed">{teacher.intro}</Text>
        </View>
      )}
      <View className="m-3 p-4 bg-white rounded-2xl">
        <Text className="text-sm text-[#333] font-semibold mb-3 block">讲师课程</Text>
        {!loading && (
          <View className="text-center py-5 text-[#999]">
            <Text>暂无课程</Text>
          </View>
        )}
      </View>
    </View>
  )
}
