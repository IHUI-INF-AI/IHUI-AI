import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { completeLesson, getProgress, type CourseProgress } from '@ihui/api-client'
import {
  VideoPlayerScreen as SharedVideoPlayerScreen,
  type VideoPlayerProgress,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { VideoPlayer } from '../components/VideoPlayer'

type Route = RouteProp<RootStackParamList, 'VideoPlayer'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'VideoPlayer'>

/** 路由 params 扩展:课程播放器在 root 导航里未声明 videoUrl,这里做结构兼容 */
type VideoPlayerRouteParams = RootStackParamList['VideoPlayer'] & {
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

  // CourseProgress 结构兼容 VideoPlayerProgress(含全部字段,lessons 为额外字段)
  const sharedProgress: VideoPlayerProgress | null = progress
    ? {
        courseId: progress.courseId,
        totalLessons: progress.totalLessons,
        completedLessons: progress.completedLessons,
        progress: progress.progress,
        lastLearnedAt: progress.lastLearnedAt,
      }
    : null

  return (
    <SharedVideoPlayerScreen
      t={t}
      title={title}
      videoUrl={videoUrl}
      progress={sharedProgress}
      completed={completed}
      completing={completing}
      loading={loading}
      error={error}
      onComplete={onCompleteLesson}
      onBack={() => navigation.goBack()}
      playerContent={
        videoUrl ? (
          <VideoPlayer
            url={videoUrl}
            title={title}
            onComplete={onPlayerComplete}
            onError={setError}
          />
        ) : undefined
      }
    />
  )
}
