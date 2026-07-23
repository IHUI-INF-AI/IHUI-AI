import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyInfo, getStudyRecords, type StudyRecord } from '@/api'
import { useI18n } from '@/i18n'

interface StudyInfo {
  todayMinutes: number
  totalMinutes: number
  continuousDays: number
  courses: number
}

const RECENT_LIMIT = 5

export default function StudyIndex() {
  const { t } = useI18n()
  const [info, setInfo] = useState<StudyInfo>({
    todayMinutes: 0,
    totalMinutes: 0,
    continuousDays: 0,
    courses: 0,
  })
  const [recent, setRecent] = useState<StudyRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [infoRes, recordRes] = await Promise.all([
        getStudyInfo(),
        getStudyRecords({ page: 1, pageSize: RECENT_LIMIT }),
      ])
      setInfo(infoRes)
      setRecent(recordRes?.list || [])
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

  const goVideo = useCallback((r: StudyRecord) => {
    Taro.navigateTo({
      url: `/pages/study/video-detail/index?id=${r.id}&courseId=${r.courseId}`,
    })
  }, [])

  const entries = [
    { icon: '📋', labelKey: 'study.record', url: '/pages/study/record' },
    { icon: '🎯', labelKey: 'study.plan', url: '/pages/study/plan' },
    { icon: '🏆', labelKey: 'study.rank', url: '/pages/study/rank' },
    { icon: '📝', labelKey: 'study.exam', url: '/pages/exam/list' },
    { icon: '📚', labelKey: 'profile.myCourses', url: '/pages/study/my-study/index' },
  ]

  return (
    <View className="min-h-screen bg-background pb-[72px]">
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

      <View className="m-3 bg-card rounded-2xl p-2 flex flex-col gap-1">
        {entries.map((e) => (
          <View
            key={e.url}
            className="flex items-center p-3"
            onClick={() => navigate(e.url)}
          >
            <Text>{e.icon}</Text>
            <Text className="flex-1 ml-3 text-sm text-foreground">{t(e.labelKey)}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
        ))}
      </View>

      <View className="m-3 p-4 bg-card rounded-2xl">
        <Text className="text-base text-foreground font-semibold mb-3 block">
          {t('study.continueLearning')}
        </Text>
        {loading ? (
          <View className="text-center py-6 text-muted-foreground">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : recent.length > 0 ? (
          <View className="flex flex-col gap-1">
            {recent.map((r) => (
              <View
                key={r.id}
                className="flex items-center p-2"
                onClick={() => goVideo(r)}
              >
                <View className="flex-1">
                  <Text className="block text-sm text-foreground">{r.courseTitle}</Text>
                  <Text className="block text-xs text-muted-foreground mt-1">
                    {`${t('study.recordPage.progress').replace(/\s*\{\{n\}\}\s*%?/, '')} ${r.progress}%`}
                  </Text>
                </View>
                <Text className="text-muted-foreground">›</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="text-center py-6 text-muted-foreground">
            <Text>{t('study.emptyCourse')}</Text>
          </View>
        )}
      </View>

      <View
        className="fixed bottom-5 right-4 w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center text-xl shadow-md"
        onClick={() => navigate('/pages/study/publish/index')}
      >
        <Text>+</Text>
      </View>
    </View>
  )
}
