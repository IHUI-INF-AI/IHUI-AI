import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button } from '@ihui/ui-native'
import { completeLesson, getProgress, type CourseProgress } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { HomeStackParamList } from '../navigation/RootNavigator'
import { VideoPlayer } from '../components/VideoPlayer'

type Route = RouteProp<HomeStackParamList, 'VideoPlayer'>
type NavigationProp = NativeStackNavigationProp<HomeStackParamList>

/** 路由 params 扩展:课程播放器在 root 导航里未声明 videoUrl,这里做结构兼容 */
type VideoPlayerRouteParams = HomeStackParamList['VideoPlayer'] & {
  videoUrl?: string
  duration?: number
}

export function VideoPlayerScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const params = route.params as VideoPlayerRouteParams
  const { courseId, lessonId, title, videoUrl } = params
  const [progress, setProgress] = useState<CourseProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getProgress(courseId)
      if (cancelled) return
      if (res.success) {
        setProgress(res.data)
        const current = res.data.lessons.find((l) => l.lessonId === lessonId)
        setCompleted(current?.isCompleted ?? false)
      } else {
        setError(res.error || t('course.playError'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, lessonId, t])

  const onCompleteLesson = useCallback(async () => {
    setCompleting(true)
    const res = await completeLesson({ courseId, lessonId })
    setCompleting(false)
    if (res.success) {
      setCompleted(true)
      if (progress) {
        setProgress({
          ...progress,
          completedLessons: Math.min(progress.completedLessons + 1, progress.totalLessons),
        })
      }
    } else {
      setError(res.error || t('common.failed'))
    }
  }, [courseId, lessonId, progress, t])

  const onPlayerComplete = useCallback(() => {
    // 真视频播完时自动标记完成(若尚未完成)
    if (!completed) {
      void onCompleteLesson()
    }
  }, [completed, onCompleteLesson])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-between bg-black px-4 pt-12 pb-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-base text-white">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-sm text-white" numberOfLines={1}>
          {title ?? ''}
        </Text>
        <View className="w-10" />
      </View>

      {videoUrl ? (
        <VideoPlayer
          url={videoUrl}
          title={title}
          onComplete={onPlayerComplete}
          onError={setError}
        />
      ) : (
        <View className="aspect-video w-full items-center justify-center bg-neutral-900">
          <Text className="text-base text-neutral-400">{t('player.noUrl')}</Text>
          <Text className="mt-2 text-xs text-neutral-500">{t('course.player')}</Text>
        </View>
      )}

      <View className="flex-1 bg-white p-4">
        <Text className="text-lg font-semibold text-neutral-900">{t('course.progress')}</Text>
        {progress ? (
          <View className="mt-2">
            <View className="h-2 overflow-hidden rounded-md bg-neutral-200">
              <View
                className="h-2 bg-emerald-500"
                style={{
                  width: `${Math.round((progress.completedLessons / Math.max(progress.totalLessons, 1)) * 100)}%`,
                }}
              />
            </View>
            <Text className="mt-1 text-xs text-neutral-500">
              {t('course.progressLessons', {
                completed: progress.completedLessons,
                total: progress.totalLessons,
              })}
            </Text>
          </View>
        ) : null}

        {error ? <Text className="mt-2 text-xs text-red-500">{error}</Text> : null}

        <View className="mt-6">
          {completed ? (
            <View className="rounded-md bg-emerald-50 p-3">
              <Text className="text-sm text-emerald-700">✓ {t('course.completed')}</Text>
            </View>
          ) : (
            <Button loading={completing} onPress={onCompleteLesson}>
              {t('course.complete')}
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}
