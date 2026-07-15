import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getExamPaper, getExamQuestions, type ExamPaper } from '@/api'
import { useI18n } from '@/i18n'

type ExamDetail = ExamPaper & { questionCount: number }

export default function ExamDetail() {
  const { t } = useI18n()
  const router = useRouter()
  const [exam, setExam] = useState<ExamDetail>({} as ExamDetail)

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    Promise.all([getExamPaper(id), getExamQuestions(id)])
      .then(([{ paper }, { list }]) => {
        setExam({ ...paper, questionCount: list.length })
      })
      .catch((e) => {
        logger.error('unknown', '考试详情加载', e)
        Taro.showToast({ title: t('exam.detail.loadFailed'), icon: 'none' })
      })
  }, [router.params.id, t])

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
              <Text className="block text-xs text-[#999]">{t('exam.detail.questionCount')}</Text>
              <Text className="block text-base text-[#07c160] font-semibold mt-1">
                {t('exam.detail.questionCountValue', { n: exam.questionCount })}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-xs text-[#999]">{t('exam.detail.duration')}</Text>
              <Text className="block text-base text-[#07c160] font-semibold mt-1">
                {t('exam.detail.durationValue', { n: exam.duration || 0 })}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-xs text-[#999]">{t('exam.detail.passScore')}</Text>
              <Text className="block text-base text-[#07c160] font-semibold mt-1">
                {t('exam.detail.passScoreValue', { n: exam.passScore || 0 })}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View className="m-3 p-4 bg-white rounded-2xl">
        <Text className="text-sm text-[#333] font-semibold mb-3 block">
          {t('exam.detail.noticeTitle')}
        </Text>
        <Text className="block text-sm text-[#666] leading-loose">{t('exam.detail.notice1')}</Text>
        <Text className="block text-sm text-[#666] leading-loose">{t('exam.detail.notice2')}</Text>
        <Text className="block text-sm text-[#666] leading-loose">{t('exam.detail.notice3')}</Text>
        <Text className="block text-sm text-[#666] leading-loose">{t('exam.detail.notice4')}</Text>
      </View>

      {exam.title && (
        <Button
          className="fixed bottom-4 left-4 right-4 bg-[#07c160] text-white rounded-full text-base"
          onClick={onStart}
        >
          {t('exam.detail.start')}
        </Button>
      )}
    </View>
  )
}
