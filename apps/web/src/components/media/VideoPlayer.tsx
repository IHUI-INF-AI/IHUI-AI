'use client'

import * as React from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  poster?: string
  autoPlay?: boolean
  controls?: boolean
  loop?: boolean
  muted?: boolean
  className?: string
}

export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  controls = true,
  loop = false,
  muted = false,
  className,
}: VideoPlayerProps) {
  const ref = React.useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = React.useState(autoPlay)
  const [mutedState, setMutedState] = React.useState(muted)
  const [progress, setProgress] = React.useState(0)
  const [duration, setDuration] = React.useState(0)

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
        ref={ref}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(ref.current?.duration ?? 0)}
        onClick={togglePlay}
        className="h-full w-full"
      >
        <track kind="captions" />
      </video>
      {controls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={handleSeek}
            className="mb-2 h-1 w-full cursor-pointer appearance-none rounded bg-white/30 accent-primary"
          />
          <div className="flex items-center gap-2 text-white">
            <button onClick={togglePlay} className="rounded p-1 hover:bg-white/20">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button onClick={() => skip(-10)} className="rounded p-1 hover:bg-white/20">
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={() => skip(10)} className="rounded p-1 hover:bg-white/20">
              <SkipForward className="h-4 w-4" />
            </button>
            <button onClick={toggleMute} className="rounded p-1 hover:bg-white/20">
              {mutedState ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="text-xs">
              {fmt((progress / 100) * duration)} / {fmt(duration)}
            </span>
            <button onClick={fullscreen} className="ml-auto rounded p-1 hover:bg-white/20">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
