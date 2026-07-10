import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getExamResult } from '@/api'

interface ExamResultInfo {
  score: number
  pass: boolean
  rank?: number
  total?: number
}

export default function ExamResult() {
  const router = useRouter()
  const [info, setInfo] = useState<ExamResultInfo>({ score: 0, pass: false })

  useEffect(() => {
    const params = router.params
    if (params.score) {
      setInfo({ score: Number(params.score), pass: params.pass === 'true' })
      return
    }
    if (!params.id) return
    getExamResult(params.id)
      .then(res => setInfo(res))
      .catch(() => {})
  }, [router.params])

  const goList = useCallback(() => {
    Taro.redirectTo({ url: '/pages/exam/list' })
  }, [])

  const goStudy = useCallback(() => {
    Taro.navigateTo({ url: '/pages/study/index' })
  }, [])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="py-16 text-center">
        <View
          className={`w-20 h-20 leading-20 mx-auto rounded-full text-4xl text-white ${info.pass ? 'bg-[#4caf50]' : 'bg-[#dd524d]'}`}
        >
          {info.pass ? '✓' : '×'}
        </View>
        <Text className="block text-lg text-[#333] font-semibold mt-4">{info.pass ? '考试通过' : '未通过'}</Text>
        <Text className="block text-3xl text-[#007aff] font-bold mt-2">{info.score}分</Text>
      </View>

      <View className="m-3 p-4 bg-white rounded-2xl">
        <View className="flex justify-between py-3 border-b border-[#f5f5f5]">
          <Text className="text-sm text-[#999]">得分</Text>
          <Text className="text-sm text-[#333]">{info.score}分</Text>
        </View>
        <View className="flex justify-between py-3 border-b border-[#f5f5f5]">
          <Text className="text-sm text-[#999]">是否通过</Text>
          <Text className={`text-sm ${info.pass ? 'text-[#4caf50]' : 'text-[#333]'}`}>
            {info.pass ? '通过' : '未通过'}
          </Text>
        </View>
        {info.rank && (
          <View className="flex justify-between py-3">
            <Text className="text-sm text-[#999]">排名</Text>
            <Text className="text-sm text-[#333]">第{info.rank}名 / {info.total}人</Text>
          </View>
        )}
      </View>

      <View className="px-6">
        <Button className="mt-4 bg-[#007aff] text-white rounded-full text-sm w-full" onClick={goList}>
          返回列表
        </Button>
        <Button className="mt-4 bg-white text-[#333] rounded-full text-sm w-full" onClick={goStudy}>
          继续学习
        </Button>
      </View>
    </View>
  )
}
