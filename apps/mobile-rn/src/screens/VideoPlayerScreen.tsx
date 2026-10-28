// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getCourseById,
  getProgress,
  reportLessonProgress,
  type CourseDetail,
  type CourseSection,
  type LessonProgress,
} from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
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

/**
 * 心跳上报最小间隔(毫秒)—— 服务端路由注释约定「前端定时调用,每 10-15 秒」。
 * 播放器 onProgress 每 1 秒回调一次,不节流会把学习记录刷成日志洪水。
 */
const HEARTBEAT_INTERVAL_MS = 15_000
/**
 * 单次进度回调能计入「观看时长」的上限(秒)。
 * 拖动 seek 会让 currentTime 瞬间跳变,那不是真看出来的时长;服务端把 duration
 * 累加进 watchDuration,而自动完成要求真实观看 ≥ 总时长 90% —— 灌水等于把
 * 判据本身打穿,所以超过 60 秒的跳变一律不计入。
 */
const WATCH_DELTA_CAP_SECONDS = 60

/**
 * 课程视频播放屏 —— 进度按**小节**记,出口只有心跳一个:
 *
 *  - 取数:`GET /api/learn/lessons/:id`(章节树,拿小节 videoUrl/时长)
 *    与 `GET /api/learn/lessons/:id/progress`(按小节的 sectionProgress)并行;
 *    进度端点 404 = 未报名 / 401 = 未登录,**不写 error** —— 课程详情页有报名按钮兜底。
 *  - 播放中:onProgress 每秒回调,攒 15 秒发一次 `POST .../heartbeat`
 *    ({sectionId, chapterId, position, duration},单位都是秒;duration = 这一段真实观看增量)。
 *  - 完成:服务端**没有**完成端点,唯一判据是心跳里的自动完成
 *    (进度 ≥90% 且观看 ≥ 总时长 90%,learn-record-queries.ts checkAutoComplete)。
 *    所以「标记完成」= 心跳把 position 推到小节末尾 + 把观看时长补足 90% 门槛。
 */
export function VideoPlayerScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const params = route.params as VideoPlayerRouteParams
  const { courseId, lessonId, title } = params

  const [detail, setDetail] = useState<CourseDetail | null>(null)
  const [progress, setProgress] = useState<LessonProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  /** 本小节状态的本地覆盖(心跳返回后写入;null = 用进度端点的初值) */
  const [sectionStatus, setSectionStatus] = useState<number | null>(null)

  /** 上一次心跳时刻(ms);0 = 还没报过,首个进度回调立即建记录 */
  const lastHeartbeatAtRef = useRef(0)
  /** 上一次进度回调的 currentTime(null = 本节首次回调,不计入观看时长) */
  const lastPositionRef = useRef<number | null>(null)
  /** 两次心跳之间攒下、还没上报的真实观看秒数 */
  const pendingWatchRef = useRef(0)
  /** 播放器报告过的媒体时长(秒)—— 小节行没标时长时的 totalDuration 兜底 */
  const playerDurationRef = useRef(0)

  /** 课程下的小节(可播放项)—— 章节为顶层,小节挂在 sections 里 */
  const sections: CourseSection[] = useMemo(
    () => detail?.chapters.flatMap((chapter) => chapter.sections) ?? [],
    [detail],
  )
  /** 当前小节 —— lessonId 就是小节 id(CourseDetailScreen.onPlay 传的 section.id) */
  const section = useMemo(() => sections.find((s) => s.id === lessonId), [sections, lessonId])
  /** 进度端点给本小节的行(未报名 / 无记录时是 null) */
  const sectionProgress = useMemo(
    () => progress?.sectionProgress.find((sp) => sp.sectionId === lessonId) ?? null,
    [progress, lessonId],
  )

  // 视频地址:详情页路由已带 videoUrl;兜底回详情的章节树按 lessonId 找小节行。
  const videoUrl = params.videoUrl ?? section?.videoUrl ?? undefined
  const completed = (sectionStatus ?? sectionProgress?.status ?? 0) === 2

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [courseRes, progressRes] = await Promise.all([
        getCourseById(courseId),
        getProgress(courseId),
      ])
      if (cancelled) return
      if (courseRes.success) {
        setDetail(courseRes.data)
      } else {
        setError(apiFailureToText(courseRes, t('course.loadFailed')))
      }
      // 进度端点失败(404 未报名 / 401 未登录)一律静默:报名按钮在课程详情页
      if (progressRes.success) setProgress(progressRes.data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, t])

  // 换小节(同屏复用路由参数)时清运行时状态,别把上一节的攒量/节流带过来
  useEffect(() => {
    setSectionStatus(null)
    lastHeartbeatAtRef.current = 0
    lastPositionRef.current = null
    pendingWatchRef.current = 0
    playerDurationRef.current = 0
  }, [lessonId])

  /**
   * 一次心跳。必须带小节:服务端按 (user, lesson, section) upsert 记录,
   * 没有 sectionId 的记录 totalDuration 恒为 0,progress 永远涨不上去。
   * 返回更新后的本小节状态;失败返回 null 并静默(未报名 403 是预期态,不刷错误条)。
   */
  const sendHeartbeat = useCallback(
    async (position: number, watchDelta: number): Promise<number | null> => {
      const sectionId = section?.id ?? lessonId
      const res = await reportLessonProgress({
        courseId,
        sectionId,
        ...(section?.chapterId ? { chapterId: section.chapterId } : {}),
        position,
        duration: watchDelta,
      })
      if (!res.success) return null
      const r = res.data
      setSectionStatus(r.status)
      // 把进度端点的本小节行同步成服务端事实(「标记完成」的 90% 补差按它算基数)
      setProgress((prev) => {
        if (!prev) return prev
        const row = {
          sectionId,
          progress: r.progress,
          status: r.status,
          watchDuration: r.watchDuration,
          lastPosition: r.lastPosition,
        }
        const exists = prev.sectionProgress.some((sp) => sp.sectionId === sectionId)
        return {
          ...prev,
          sectionProgress: exists
            ? prev.sectionProgress.map((sp) => (sp.sectionId === sectionId ? row : sp))
            : [...prev.sectionProgress, row],
        }
      })
      return r.status
    },
    [courseId, lessonId, section],
  )

  /** 播放进度回调(每秒):攒观看时长 + 按 15 秒节流发心跳 */
  const onPlayerProgress = useCallback(
    (currentTime: number, durationSeconds: number) => {
      if (durationSeconds > 0) playerDurationRef.current = durationSeconds
      const last = lastPositionRef.current
      lastPositionRef.current = currentTime
      if (last !== null) {
        const delta = currentTime - last
        if (delta > 0 && delta <= WATCH_DELTA_CAP_SECONDS) pendingWatchRef.current += delta
      }
      const now = Date.now()
      if (now - lastHeartbeatAtRef.current < HEARTBEAT_INTERVAL_MS) return
      lastHeartbeatAtRef.current = now
      const watch = pendingWatchRef.current
      pendingWatchRef.current = 0
      void sendHeartbeat(currentTime, watch)
    },
    [sendHeartbeat],
  )

  /**
   * 「标记完成」的唯一实现:服务端没有完成端点,完成只能靠心跳的自动判定
   * (进度 ≥90% 且观看 ≥ 总时长 90%)。所以把 position 推到小节末尾拿满进度,
   * 并把本条心跳的观看时长补足到 90% 门槛 —— 用户显式点「标记完成」/看完整条
   * 视频时,这是对服务端契约唯一的合规走法。
   * 基数取 sectionProgress.watchDuration(服务端事实,已被上面的 setProgress 保鲜)。
   */
  const completeSection = useCallback(async (): Promise<boolean> => {
    const total = Math.max(section?.durationSeconds ?? 0, playerDurationRef.current)
    const watched = sectionProgress?.watchDuration ?? 0
    const topUp = Math.max(0, Math.floor(total * 0.9) - watched)
    pendingWatchRef.current = 0
    lastHeartbeatAtRef.current = Date.now()
    const status = await sendHeartbeat(total, topUp)
    if (status === null) return false // 未报名/网络失败:静默,详情页报名按钮兜底
    if (status === 2) return true
    setError(t('common.failed')) // 补差后仍未翻 2:多半是拿不到总时长,如实报失败
    return false
  }, [section, sectionProgress, sendHeartbeat, t])

  const onCompleteLesson = useCallback(async () => {
    setCompleting(true)
    await completeSection()
    setCompleting(false)
  }, [completeSection])

  const onPlayerComplete = useCallback(() => {
    // 真视频播完:先把攒下的观看时长冲账(不节流)。服务端达标就自动完成;
    // 没达标(比如中途拖过进度)再补一次「标记完成」,保住播完即完成的体验。
    const watch = pendingWatchRef.current
    pendingWatchRef.current = 0
    lastHeartbeatAtRef.current = Date.now()
    const endPosition = Math.max(lastPositionRef.current ?? 0, playerDurationRef.current)
    void (async () => {
      const status = await sendHeartbeat(endPosition, watch)
      if (status !== 2) await completeSection()
    })()
  }, [sendHeartbeat, completeSection])

  /** 共享进度条契约:完成数按小节统计(进度端点初值 + 心跳本地覆盖合并) */
  const sharedProgress = useMemo<VideoPlayerProgress | null>(() => {
    if (!progress) return null
    const doneIds = new Set<string>()
    for (const sp of progress.sectionProgress) {
      if (sp.status === 2 && sp.sectionId) doneIds.add(sp.sectionId)
    }
    if (sectionStatus === 2) doneIds.add(lessonId)
    else if (sectionStatus !== null) doneIds.delete(lessonId)
    const total = sections.length > 0 ? sections.length : progress.sectionProgress.length
    const completedLessons =
      sections.length > 0
        ? [...doneIds].filter((id) => sections.some((s) => s.id === id)).length
        : doneIds.size
    return {
      courseId,
      totalLessons: total,
      completedLessons,
      progress: progress.progress,
      lastLearnedAt: null,
    }
  }, [progress, sections, sectionStatus, lessonId, courseId])

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
            startPosition={sectionProgress?.lastPosition ?? 0}
            onProgress={onPlayerProgress}
            onComplete={onPlayerComplete}
            onError={setError}
          />
        ) : undefined
      }
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
