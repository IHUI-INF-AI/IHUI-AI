// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMediaRelease } from './media-release'

interface VideoPlayerProps {
  src: string
  poster?: string
  autoPlay?: boolean
  controls?: boolean
  loop?: boolean
  muted?: boolean
  className?: string
  /**
   * G-856:这一项当前是否**在场**(宿主用 CSS 隐藏/切到别的 tab 时传 false)。
   * false ⇒ 立即暂停(源留着,回来可续播);卸载/换 src ⇒ 暂停 + 摘源 + 复位(见 media-release)。
   * 默认 true ⇒ 与改造前逐字一致。
   */
  active?: boolean
}

/**
 * G-856 纪律①(与 G-751 的 ImageViewer 同源):状态↔源配对。
 * 失败态按**这一项的源**存档,不做全局 `error` —— 队列里换到别的一项时,
 * 旧的一项失败不许把新的一项染成失败,新的一项也不许继承旧的终态。
 */
type DecodeStatus = 'loading' | 'ready' | 'error'

export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  controls = true,
  loop = false,
  muted = false,
  className,
  active = true,
}: VideoPlayerProps) {
  const t = useTranslations('a11y')
  const ref = React.useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = React.useState(autoPlay)
  const [mutedState, setMutedState] = React.useState(muted)
  const [progress, setProgress] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  // 重试出口:换 nonce ⇒ 换节点(key 变)⇒ 旧的失败终态随之作废,不靠"假装没失败"
  const [nonce, setNonce] = React.useState(0)
  const mediaKey = `${nonce}\u0000${src}`
  const [decode, setDecode] = React.useState<{ source: string; status: DecodeStatus }>(() => ({
    source: mediaKey,
    status: 'loading',
  }))
  const status = decode.source === mediaKey ? decode.status : 'loading'

  // 切离即停:换 src(切 item)/ 卸载(关弹层、宿主摘掉这一项)⇒ 释放解码资源;
  // active=false(视图被藏起来)⇒ 暂停。宿主元素按源重建(纪律②),见 media-release 的用法约束。
  useMediaRelease(ref, src, active)

  const togglePlay = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const toggleMute = () => {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setMutedState(v.muted)
  }

  const handleTimeUpdate = () => {
    const v = ref.current
    if (!v) return
    setProgress((v.currentTime / v.duration) * 100 || 0)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = ref.current
    if (!v) return
    v.currentTime = (Number(e.target.value) / 100) * v.duration
  }

  const skip = (seconds: number) => {
    const v = ref.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds))
  }

  const fullscreen = () => {
    ref.current?.requestFullscreen()
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('group relative overflow-hidden rounded-lg bg-black', className)}>
      <video
        // 纪律②:按源重建节点 —— 换 item 即换节点,旧节点的收口必然发生,
        // 旧源的迟到事件也不会命中新节点的处理器
        key={mediaKey}
        ref={ref}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={() => {
          setDuration(ref.current?.duration ?? 0)
          setDecode({ source: mediaKey, status: 'ready' })
        }}
        onError={(e) => {
          // 切离收口时会主动摘掉 src(见 media-release),部分浏览器把这一下补发成 error。
          // 元素上已经没有源 ⇒ 不是解码失败,不许写终态,否则"切走再回来"变成满屏失败。
          if (!e.currentTarget.getAttribute('src')) return
          setDecode({ source: mediaKey, status: 'error' })
        }}
        onClick={togglePlay}
        className="h-full w-full"
      >
        <track kind="captions" />
      </video>
      {/* G-856 ②:这一项解码失败 ⇒ 只在本项的位置摆**终态**(带文案与重试出口),
          不永久停在最后一帧、也不整块白屏;队列里其它项各自渲染自己的状态,不受影响。 */}
      {status === 'error' && (
        <div
          data-video-state="error"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white"
        >
          <AlertCircle className="h-8 w-8" aria-hidden />
          <p className="text-sm">{t('videoLoadFailed')}</p>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            aria-label={t('previewRetryAction')}
            className="rounded-sm p-1 text-xs underline hover:bg-white/20"
          >
            {t('previewRetryAction')}
          </button>
        </div>
      )}
      {controls && status !== 'error' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <input
            type="range"
            aria-label={t('seekBar')}
            min={0}
            max={100}
            value={progress}
            onChange={handleSeek}
            className="mb-2 h-1 w-full cursor-pointer appearance-none rounded-sm bg-white/30 accent-primary"
          />
          <div className="flex items-center gap-2 text-white">
            <button
              onClick={togglePlay}
              aria-label={playing ? t('pause') : t('play')}
              className="rounded-sm p-1 hover:bg-white/20"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={() => skip(-10)}
              aria-label={t('seekBackward')}
              className="rounded-sm p-1 hover:bg-white/20"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => skip(10)}
              aria-label={t('seekForward')}
              className="rounded-sm p-1 hover:bg-white/20"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={toggleMute}
              aria-label={mutedState ? t('unmute') : t('mute')}
              className="rounded-sm p-1 hover:bg-white/20"
            >
              {mutedState ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="text-xs">
              {fmt((progress / 100) * duration)} / {fmt(duration)}
            </span>
            <button
              onClick={fullscreen}
              aria-label={t('fullscreen')}
              className="ml-auto rounded-sm p-1 hover:bg-white/20"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
