// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square, Play, Pause, Trash2, Download } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'

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
  const t = useTranslations('voiceRecord')
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

  React.useEffect(
    () => () => {
      cleanup()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    },
    [cleanup, audioUrl],
  )

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
      setError(e instanceof Error ? e.message : t('micError'))
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

      <div className="flex items-center gap-2" data-testid="voice-record">
        {!isRecording ? (
          <Button onClick={startRecording} size="sm" data-testid="voice-record-start">
            <Mic className="h-4 w-4" />
            {t('startRecording')}
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
            <Button
              variant="outline"
              size="sm"
              onClick={togglePause}
              data-testid="voice-record-pause"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isPaused ? t('resume') : t('pause')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              data-testid="voice-record-stop"
            >
              <Square className="h-4 w-4" />
              {t('stop')}
            </Button>
          </>
        )}
      </div>

      {audioUrl && !isRecording && (
        <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <Button variant="ghost" size="icon-sm" onClick={togglePlay}>
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
          >
            <track kind="captions" />
          </audio>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip content={t('download')}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={downloadRecording}
                data-testid="voice-record-download"
              >
                <Download className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content={t('remove')}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={deleteRecording}
                data-testid="voice-record-remove"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}

export default VoiceRecord
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
