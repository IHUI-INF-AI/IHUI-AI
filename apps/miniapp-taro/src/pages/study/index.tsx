import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyInfo } from '@/api'
import { useI18n } from '@/i18n'

interface StudyInfo {
  todayMinutes: number
  totalMinutes: number
  continuousDays: number
  courses: number
}

export default function StudyIndex() {
  const { t } = useI18n()
  const [info, setInfo] = useState<StudyInfo>({
    todayMinutes: 0,
    totalMinutes: 0,
    continuousDays: 0,
    courses: 0,
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getStudyInfo()
      setInfo(res)
    } catch {
      // 统一提示
    } finally {
      setLoading(false)
    }
  }, [])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-background">
      <View className="p-6 bg-gradient-to-br from-[#00f2ff] to-[#8b5cf6]">
        <View className="flex flex-wrap">
          <View className="w-1/2 text-center mb-3 text-white">
            <Text className="block text-xl font-bold">{info.todayMinutes}</Text>
            <Text className="block text-xs opacity-90 mt-0.5">{t('study.todayMinutes')}</Text>
          </View>
          <View className="w-1/2 text-center mb-3 text-white">
            <Text className="block text-xl font-bold">{info.totalMinutes}</Text>
            <Text className="block text-xs opacity-90 mt-0.5">{t('study.totalMinutes')}</Text>
          </View>
          <View className="w-1/2 text-center mb-3 text-white">
            <Text className="block text-xl font-bold">{info.continuousDays}</Text>
            <Text className="block text-xs opacity-90 mt-0.5">{t('study.continuousDays')}</Text>
          </View>
          <View className="w-1/2 text-center mb-3 text-white">
            <Text className="block text-xl font-bold">{info.courses}</Text>
            <Text className="block text-xs opacity-90 mt-0.5">{t('study.courses')}</Text>
          </View>
        </View>
      </View>
      <View className="m-3 bg-card rounded-2xl overflow-hidden">
        <View
          className="flex items-center p-4 border-b border-[#f5f5f] text-base"
          onClick={() => navigate('/pages/study/record')}
        >
          <Text>📋</Text>
          <Text className="flex-1 ml-3 text-sm text-foreground">{t('study.record')}</Text>
          <Text className="text-muted-foreground">›</Text>
        </View>
        <View
          className="flex items-center p-4 border-b border-border text-base"
          onClick={() => navigate('/pages/study/plan')}
        >
          <Text>🎯</Text>
          <Text className="flex-1 ml-3 text-sm text-foreground">{t('study.plan')}</Text>
          <Text className="text-muted-foreground">›</Text>
        </View>
        <View
          className="flex items-center p-4 border-b border-border text-base"
          onClick={() => navigate('/pages/study/rank')}
        >
          <Text>🏆</Text>
          <Text className="flex-1 ml-3 text-sm text-foreground">{t('study.rank')}</Text>
          <Text className="text-muted-foreground">›</Text>
        </View>
        <View
          className="flex items-center p-4 text-base"
          onClick={() => navigate('/pages/exam/list')}
        >
          <Text>📝</Text>
          <Text className="flex-1 ml-3 text-sm text-foreground">{t('study.exam')}</Text>
          <Text className="text-muted-foreground">›</Text>
        </View>
      </View>
      <View className="m-3 p-4 bg-card rounded-2xl">
        <Text className="text-base text-foreground font-semibold mb-3 block">
          {t('study.continueLearning')}
        </Text>
        {!loading && (
          <View className="text-center py-6 text-muted-foreground">
            <Text>{t('study.emptyCourse')}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
