import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getExamResult } from '@/api'
import { useI18n } from '@/i18n'

interface ExamResultInfo {
  score: number
  pass: boolean
  rank?: number
  total?: number
}

export default function ExamResult() {
  const { t } = useI18n()
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
      .then((res) => setInfo(res))
      .catch((e) => {
        logger.error('unknown', '考试结果加载', e)
        Taro.showToast({ title: t('exam.result.loadFailed'), icon: 'none' })
      })
  }, [router.params, t])

  const goList = useCallback(() => {
    Taro.redirectTo({ url: '/pages/exam/list' })
  }, [])

  const goStudy = useCallback(() => {
    Taro.navigateTo({ url: '/pages/study/index' })
  }, [])

  return (
    <View className="min-h-screen bg-background">
      <View className="py-16 text-center">
        <View
          className={`w-20 h-20 leading-20 mx-auto rounded-2xl text-4xl text-white ${info.pass ? 'bg-[#4caf50]' : 'bg-[#dd524d]'}`}
        >
          {info.pass ? '✓' : '×'}
        </View>
        <Text className="block text-lg text-foreground font-semibold mt-4">
          {info.pass ? t('exam.result.pass') : t('exam.result.notPass')}
        </Text>
        <Text className="block text-3xl text-primary font-bold mt-2">
          {t('exam.result.scoreValue', { n: info.score })}
        </Text>
      </View>

      <View className="m-3 p-4 bg-card rounded-2xl">
        <View className="flex justify-between py-3 border-b border-border">
          <Text className="text-sm text-muted-foreground">{t('exam.result.score')}</Text>
          <Text className="text-sm text-foreground">
            {t('exam.result.scoreValue', { n: info.score })}
          </Text>
        </View>
        <View className="flex justify-between py-3 border-b border-border">
          <Text className="text-sm text-muted-foreground">{t('exam.result.isPass')}</Text>
          <Text className={`text-sm ${info.pass ? 'text-[#4caf50]' : 'text-foreground'}`}>
            {info.pass ? t('exam.result.passLabel') : t('exam.result.notPassLabel')}
          </Text>
        </View>
        {info.rank && (
          <View className="flex justify-between py-3">
            <Text className="text-sm text-muted-foreground">{t('exam.result.rank')}</Text>
            <Text className="text-sm text-foreground">
              {t('exam.result.rankValue', { n: info.rank, total: info.total ?? 0 })}
            </Text>
          </View>
        )}
      </View>

      <View className="px-6">
        <Button className="mt-4 bg-primary text-white rounded-md text-sm w-full" onClick={goList}>
          {t('exam.result.goList')}
        </Button>
        <Button className="mt-4 bg-card text-foreground rounded-md text-sm w-full" onClick={goStudy}>
          {t('exam.result.goStudy')}
        </Button>
      </View>
    </View>
  )
}
