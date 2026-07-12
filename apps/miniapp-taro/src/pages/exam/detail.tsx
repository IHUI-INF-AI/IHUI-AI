import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getExamDetail, type Exam } from '@/api'

type ExamDetail = Exam & { questions: Array<{ id: string; title: string; options: string[] }> }

export default function ExamDetail() {
  const router = useRouter()
  const [exam, setExam] = useState<ExamDetail>({} as ExamDetail)

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    getExamDetail(id)
      .then((res) => setExam(res))
      .catch((e) => {
        console.error('考试详情加载 failed:', e)
        Taro.showToast({ title: '考试详情加载失败', icon: 'none' })
      })
  }, [router.params.id])

  const onStart = useCallback(() => {
    Taro.navigateTo({ url: `/pages/exam/answer?id=${exam.id}` })
  }, [exam.id])

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[60px]">
      {exam.title && (
        <View className="m-3 p-4 bg-white rounded-2xl">
          <Text className="text-lg text-[#333] font-bold">{exam.title}</Text>
          <View className="flex mt-4">
            <View className="flex-1 text-center">
              <Text className="block text-xs text-[#999]">题量</Text>
              <Text className="block text-base text-[#007aff] font-semibold mt-1">
                {exam.questions}题
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-xs text-[#999]">时长</Text>
              <Text className="block text-base text-[#007aff] font-semibold mt-1">
                {exam.duration}分钟
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-xs text-[#999]">及格</Text>
              <Text className="block text-base text-[#007aff] font-semibold mt-1">
                {exam.passScore}分
              </Text>
            </View>
          </View>
          {exam.startTime && (
            <Text className="block mt-3 text-xs text-[#999]">
              考试时间：{exam.startTime} - {exam.endTime}
            </Text>
          )}
        </View>
      )}

      <View className="m-3 p-4 bg-white rounded-2xl">
        <Text className="text-sm text-[#333] font-semibold mb-3 block">考试须知</Text>
        <Text className="block text-sm text-[#666] leading-loose">1. 考试开始后计时不可暂停</Text>
        <Text className="block text-sm text-[#666] leading-loose">2. 每题选择后不可修改</Text>
        <Text className="block text-sm text-[#666] leading-loose">3. 达到及格分数即通过</Text>
        <Text className="block text-sm text-[#666] leading-loose">4. 考试结束后自动提交</Text>
      </View>

      {exam.title && (
        <Button
          className="fixed bottom-4 left-4 right-4 bg-[#007aff] text-white rounded-full text-base"
          onClick={onStart}
        >
          开始考试
        </Button>
      )}
    </View>
  )
}
