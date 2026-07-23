'use client'

import * as React from 'react'
import type Hls from 'hls.js'
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LivePlayerProps {
  src: string
  poster?: string
  autoPlay?: boolean
  muted?: boolean
  className?: string
  onTimeUpdate?: (currentTime: number, duration: number) => void
}

function isHlsStream(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url) || url.toLowerCase().includes('m3u8')
}

function isFlvStream(url: string): boolean {
  return /\.flv(\?|$)/i.test(url)
}

export function LivePlayer({
  src,
  poster,
  autoPlay = false,
  muted = false,
  className,
  onTimeUpdate,
}: LivePlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hlsRef = React.useRef<Hls | null>(null)
  const [playing, setPlaying] = React.useState(autoPlay)
  const [mutedState, setMutedState] = React.useState(muted)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const retryCount = React.useRef(0)
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = React.useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current)
      retryTimer.current = null
    }
  }, [])

  const attachHls = React.useCallback(
    async (url: string) => {
      const video = videoRef.current
      if (!video) return

      cleanup()
      setLoading(true)
      setError(null)

      if (isFlvStream(url)) {
        setError('FLV 协议需额外依赖 flv.js,暂不支持')
        setLoading(false)
        return
      }

      if (isHlsStream(url)) {
        // 动态导入 hls.js(~200KB),仅 HLS 路由按需加载,避免打进主 bundle
        const { default: HlsImpl } = await import('hls.js')
        // 二次校验:异步加载期间组件可能已卸载或 url 已变
        if (videoRef.current !== video) return

        if (HlsImpl.isSupported()) {
          const hls = new HlsImpl({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          })
          hlsRef.current = hls
          hls.loadSource(url)
          hls.attachMedia(video)
          hls.on(HlsImpl.Events.MANIFEST_PARSED, () => {
            setLoading(false)
            if (autoPlay) video.play().catch(() => {})
          })
          hls.on(HlsImpl.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              if (data.type === HlsImpl.ErrorTypes.NETWORK_ERROR && retryCount.current < 5) {
                retryCount.current += 1
                retryTimer.current = setTimeout(
                  () => {
                    hls.startLoad()
                  },
                  Math.min(1000 * Math.pow(2, retryCount.current), 8000),
                )
              } else if (data.type === HlsImpl.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError()
              } else {
                setError(`直播流错误: ${data.details}`)
                setLoading(false)
              }
            }
          })
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url
          video.addEventListener('loadedmetadata', () => {
            setLoading(false)
            if (autoPlay) video.play().catch(() => {})
          })
        } else {
          setError('当前浏览器不支持 HLS 直播')
          setLoading(false)
        }
      } else {
        video.src = url
        video.addEventListener('loadedmetadata', () => {
          setLoading(false)
          if (autoPlay) video.play().catch(() => {})
        })
        video.addEventListener('error', () => {
          setError('视频加载失败')
          setLoading(false)
        })
      }
    },
    [autoPlay, cleanup],
  )

  React.useEffect(() => {
    attachHls(src)
    return cleanup
  }, [src, attachHls, cleanup])

  const togglePlay = () => {
    const v = videoRef.current
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
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMutedState(v.muted)
  }

  const fullscreen = () => {
    const container = videoRef.current?.parentElement
    if (container) container.requestFullscreen()
  }

  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v || !onTimeUpdate) return
    onTimeUpdate(v.currentTime, v.duration || 0)
  }

  return (
    <div className={cn('group relative overflow-hidden rounded-lg bg-black', className)}>
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={onTimeUpdate ? handleTimeUpdate : undefined}
        className="h-full w-full"
      >
        <track kind="captions" />
      </video>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-2 text-white">
            <button onClick={togglePlay} className="rounded p-1 hover:bg-white/20">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button onClick={toggleMute} className="rounded p-1 hover:bg-white/20">
              {mutedState ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="ml-1 text-xs">{isHlsStream(src) ? 'HLS 直播' : '点播'}</span>
            <button onClick={fullscreen} className="ml-auto rounded p-1 hover:bg-white/20">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
