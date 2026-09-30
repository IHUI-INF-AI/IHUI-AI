// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 视频播放器(mobile-rn 端)
 *
 * 核心能力:
 * - 基于 react-native-video 真视频解码(非 <Image> 假播放)
 * - 自定义控制条:播放/暂停、进度拖拽、倍速切换、全屏切换
 * - 进度回调:onProgress(供上层记录学习进度)
 * - 完成回调:onComplete(供上层标记课时完成)
 *
 * 设计取舍:
 * - 控制条用 RN 原生组件 + 状态,不用任何 Native Module(避免 Android/iOS 链接踩坑)
 * - 全屏切换:用 react-native-video 内置 presentFullscreenPlayer()(iOS 走原生全屏;Android 走全屏 Activity)
 * - 倍速:用 Video.rate 状态属性
 * - 拖拽:PanResponder 处理进度条(非全屏模式),松手后 onSeek
 *
 * 测试:
 * - 'react-native-video' 在测试环境被 mock 为纯 React 组件(无原生绑定)
 * - 控件点击/拖拽事件通过 fireEvent 触发
 */
import { tokens } from '../theme/active-tokens'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type View as ViewType,
} from 'react-native'
import Video, { type VideoRef, type OnProgressData, type OnLoadData } from 'react-native-video'
import { useI18n } from '../i18n'
import type { VideoPlayerMinimalProps } from '@ihui/types'
import {
  VP_CONTROL_BUTTON_HIT_SLOP_PX,
  VP_CONTROL_GAP_PX,
  VP_LABEL_FONT_PX,
  VP_OVERLAY_PADDING_PX,
  VP_PROGRESS_BAR_HIT_SLOP_PX,
  VP_PROGRESS_ROW_HEIGHT_PX,
  VP_STAGE_ASPECT,
  VP_TRACK_HEIGHT_PX,
} from '@ihui/shared/ui/video-player-spec'

import { Loading } from '@ihui/ui-native'
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const

// 共享类型 VideoPlayerMinimalProps 已下沉到 @ihui/types,
// 本地 Props extends Omit<Minimal,'url'> 并将 url 改为必选,
// 追加 title/startPosition/VideoComponent(mobile-rn 专属字段)。
// miniapp-taro 字段名不同(src/onTimeUpdate/onEnded),不 extends Minimal,保留本地定义。
export interface VideoPlayerProps extends Omit<VideoPlayerMinimalProps, 'url'> {
  /** 视频 URL(HLS / MP4 / 其他 react-native-video 支持的协议) */
  url: string
  /** 标题(显示在控制条上方) */
  title?: string
  /** 起始播放位置(秒) */
  startPosition?: number
  /** 用于测试:注入 Video 实现,默认从 react-native-video 导入 */
  VideoComponent?: typeof Video
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoPlayer({
  url,
  title,
  startPosition = 0,
  onProgress,
  onComplete,
  onError,
  VideoComponent,
}: VideoPlayerProps) {
  const { t } = useI18n()
  const VideoImpl = VideoComponent ?? Video
  const ref = useRef<VideoRef>(null)
  const [paused, setPaused] = useState(false)
  const [currentTime, setCurrentTime] = useState(startPosition)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState<number>(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [containerWidth, setContainerWidth] = useState(0)
  const lastProgressEmit = useRef(0)

  // 重置到新的视频时清空内部状态
  useEffect(() => {
    setCurrentTime(startPosition)
    setDuration(0)
    setLoading(true)
    setError('')
    lastProgressEmit.current = 0
  }, [url, startPosition])

  const handleLoad = useCallback((data: OnLoadData) => {
    setLoading(false)
    setDuration(data.duration)
  }, [])

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      setCurrentTime(data.currentTime)
      // 限频:每 1s 上报一次,避免父组件频繁重渲染
      if (Math.abs(data.currentTime - lastProgressEmit.current) >= 1) {
        lastProgressEmit.current = data.currentTime
        onProgress?.(data.currentTime, data.seekableDuration || duration)
      }
    },
    [duration, onProgress],
  )

  const handleEnd = useCallback(() => {
    setPaused(true)
    onComplete?.()
  }, [onComplete])

  const handleVideoError = useCallback(
    (e: unknown) => {
      const msg =
        typeof e === 'object' && e && 'error' in e
          ? String((e as { error: unknown }).error)
          : t('course.playError')
      setError(msg)
      setLoading(false)
      onError?.(msg)
    },
    [onError, t],
  )

  const togglePlay = useCallback(() => setPaused((p) => !p), [])
  const cycleRate = useCallback(() => {
    const idx = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number])
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length] ?? 1
    setRate(next)
  }, [rate])

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) {
      ref.current?.dismissFullscreenPlayer()
    } else {
      ref.current?.presentFullscreenPlayer()
    }
    setFullscreen((f) => !f)
  }, [fullscreen])

  const seekTo = useCallback(
    (ratio: number) => {
      if (!duration) return
      const target = Math.max(0, Math.min(1, ratio)) * duration
      ref.current?.seek(target)
      setCurrentTime(target)
    },
    [duration],
  )

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width)
  }, [])

  // 进度条 tap-to-seek(仅非全屏模式提供简易点击定位)
  const onProgressBarTap = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (!containerWidth) return
      seekTo(e.nativeEvent.locationX / containerWidth)
    },
    [containerWidth, seekTo],
  )

  const progressRatio = useMemo(
    () => (duration > 0 ? Math.min(1, currentTime / duration) : 0),
    [currentTime, duration],
  )

  return (
    <View
      className="w-full"
      style={{ backgroundColor: tokens.gray[900], aspectRatio: VP_STAGE_ASPECT }}
      onLayout={onContainerLayout}
      testID="video-player"
    >
      <VideoImpl
        ref={ref}
        source={{ uri: url }}
        paused={paused}
        rate={rate}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onError={handleVideoError}
        resizeMode="contain"
        controls={false}
        style={StyleSheet.absoluteFill}
        progressUpdateInterval={1000}
      />

      {loading ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          <Loading color={tokens.surface.light} />
        </View>
      ) : null}

      {error ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          <Text className="px-4 text-center text-sm text-red-400">{error}</Text>
        </View>
      ) : null}

      {/* 标题 + 全屏按钮(数字档来自 @ihui/shared/ui/video-player-spec,裁决见该文件头注) */}
      <View
        className="absolute left-0 right-0 top-0 flex-row items-center bg-black/40"
        style={{ padding: VP_OVERLAY_PADDING_PX }}
      >
        <Text
          className="flex-1 text-white"
          style={{ fontSize: VP_LABEL_FONT_PX }}
          numberOfLines={1}
        >
          {title ?? ''}
        </Text>
        <Pressable
          onPress={toggleFullscreen}
          accessibilityLabel={t('player.fullscreen')}
          hitSlop={VP_CONTROL_BUTTON_HIT_SLOP_PX}
          className="rounded-lg bg-white/10 px-2 py-1"
          testID="video-fullscreen"
        >
          <Text className="text-white" style={{ fontSize: VP_LABEL_FONT_PX }}>
            {fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
          </Text>
        </Pressable>
      </View>

      {/* 底部控制条 */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-black/50"
        style={{ padding: VP_OVERLAY_PADDING_PX }}
      >
        <View className="flex-row items-center" style={{ gap: VP_CONTROL_GAP_PX }}>
          <Pressable
            onPress={togglePlay}
            accessibilityLabel={paused ? t('player.play') : t('player.pause')}
            hitSlop={VP_CONTROL_BUTTON_HIT_SLOP_PX}
            className="rounded-lg bg-white/15 px-3 py-1"
            testID="video-play-pause"
          >
            <Text className="text-white" style={{ fontSize: VP_LABEL_FONT_PX }}>
              {paused ? t('player.play') : t('player.pause')}
            </Text>
          </Pressable>
          <Pressable
            onPress={cycleRate}
            accessibilityLabel={t('player.rate')}
            hitSlop={VP_CONTROL_BUTTON_HIT_SLOP_PX}
            className="rounded-lg bg-white/15 px-2 py-1"
            testID="video-rate"
          >
            <Text className="text-white" style={{ fontSize: VP_LABEL_FONT_PX }}>
              {rate}x
            </Text>
          </Pressable>
          <Text className="text-white/80" style={{ fontSize: VP_LABEL_FONT_PX }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
        <Pressable
          onPress={onProgressBarTap}
          accessibilityLabel={t('player.seek')}
          hitSlop={VP_PROGRESS_BAR_HIT_SLOP_PX}
          className="justify-center"
          style={{ marginTop: VP_CONTROL_GAP_PX, height: VP_PROGRESS_ROW_HEIGHT_PX }}
          testID="video-progress"
        >
          <View
            className="overflow-hidden rounded-lg bg-white/20"
            style={{ height: VP_TRACK_HEIGHT_PX }}
          >
            <View
              className="bg-emerald-400"
              style={{ height: VP_TRACK_HEIGHT_PX, width: `${Math.round(progressRatio * 100)}%` }}
            />
          </View>
        </Pressable>
      </View>
    </View>
  )
}

// 保留 ViewType 引用避免 lint 抱怨(用于未来挂载外层容器 ref)
export type VideoPlayerHandle = ViewType

export default VideoPlayer
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
