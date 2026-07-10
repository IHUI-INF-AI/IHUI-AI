'use client'

import * as React from 'react'
import { Mic, Square, Play, Pause, Trash2, Download } from 'lucide-react'
import { Button } from '@ihui/ui'

import { cn } from '@/lib/utils'

interface VoiceRecordProps {
  /** 最大录制时长（秒） */
  maxDuration?: number
  onRecordComplete?: (blob: Blob, duration: number) => void
}

/**
 * VoiceRecord - 语音录制组件
 * 基于 MediaRecorder API 录制音频，支持播放/删除/下载
 */
export function VoiceRecord({ maxDuration = 60, onRecordComplete }: VoiceRecordProps) {
  const [isRecording, setIsRecording] = React.useState(false)
  const [isPaused, setIsPaused] = React.useState(false)
  const [duration, setDuration] = React.useState(0)
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const cleanup = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  React.useEffect(() => () => {
    cleanup()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [cleanup, audioUrl])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
        onRecordComplete?.(blob, duration)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setIsPaused(false)
      setDuration(0)
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d + 1 >= maxDuration) {
            stopRecording()
            return d + 1
          }
          return d + 1
        })
      }, 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法访问麦克风')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setIsPaused(false)
    cleanup()
  }

  const togglePause = () => {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (isPaused) {
      rec.resume()
      setIsPaused(false)
    } else {
      rec.pause()
      setIsPaused(true)
    }
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setDuration(0)
    setError(null)
  }

  const downloadRecording = () => {
    if (!audioUrl) return
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `voice-${Date.now()}.webm`
    a.click()
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        {!isRecording ? (
          <Button onClick={startRecording} size="sm">
            <Mic className="h-4 w-4" />
            开始录制
          </Button>
        ) : (
          <>
            <span
              className={cn(
                'inline-flex h-2 w-2 rounded-full',
                isPaused ? 'bg-amber-500' : 'animate-pulse bg-red-500',
              )}
            />
            <span className="font-mono text-sm tabular-nums">{formatTime(duration)}</span>
            <Button variant="outline" size="sm" onClick={togglePause}>
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isPaused ? '继续' : '暂停'}
            </Button>
            <Button variant="destructive" size="sm" onClick={stopRecording}>
              <Square className="h-4 w-4" />
              停止
            </Button>
          </>
        )}
      </div>

      {audioUrl && !isRecording && (
        <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="font-mono text-xs tabular-nums">{formatTime(duration)}</span>
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={downloadRecording} title="下载">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={deleteRecording} title="删除">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default VoiceRecord
