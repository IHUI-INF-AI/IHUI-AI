'use client'

import * as React from 'react'
import { Mic } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { voiceSttFromBlob } from '@ihui/api-client'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

// ai-service URL(浏览器直连,与 edu-api.ts 保持一致;生产环境通过 nginx/rewrites 反代)
const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8803'

function getRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * VoiceInput — 语音输入组件(零成本混合策略)。
 *
 * 主路径(Chrome/Edge):浏览器原生 webkitSpeechRecognition,零延迟零后端负载。
 * Fallback(Firefox/Safari):MediaRecorder 录音 → POST ai-service /api/voice/stt
 *   → faster-whisper 本地 CPU 推理(完全免费,首次下载 74MB 模型后离线)。
 *
 * 两条路径最终都调用 onTranscript(text),由父组件决定如何处理(通常追加到 textarea)。
 * 语音不会直接发给 LLM,转写为文字后才进入 prompt(符合用户预期)。
 */
export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const t = useTranslations('chat')
  const [recording, setRecording] = React.useState(false)
  const [supported, setSupported] = React.useState<'native' | 'fallback' | 'unsupported'>('native')

  // 原生 webkitSpeechRecognition 引用
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = React.useRef('')

  // Fallback MediaRecorder 引用
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)

  React.useEffect(() => {
    const Ctor = getRecognitionConstructor()
    if (Ctor) {
      setSupported('native')
      const recognition = new Ctor()
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        let text = ''
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i]?.[0]?.transcript ?? ''
        }
        transcriptRef.current = text
      }
      recognition.onerror = () => {
        setRecording(false)
      }
      recognition.onend = () => {
        setRecording(false)
        if (transcriptRef.current) {
          onTranscript(transcriptRef.current)
          transcriptRef.current = ''
        }
      }
      recognitionRef.current = recognition
    } else if (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    ) {
      // Firefox/Safari:不支持 webkitSpeechRecognition,但有 MediaRecorder
      setSupported('fallback')
    } else {
      setSupported('unsupported')
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      // 清理 MediaRecorder 资源
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [onTranscript])

  const startNativeRecording = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    transcriptRef.current = ''
    recognition.start()
    setRecording(true)
  }

  const stopNativeRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const startFallbackRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        // 录音停止 → 上传到 ai-service 转写(用 packages/api-client 共用封装)
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        if (audioBlob.size === 0) {
          setRecording(false)
          return
        }

        // 调用跨端共用封装(静默处理失败,不阻塞用户输入)
        const text = await voiceSttFromBlob({
          blob: audioBlob,
          filename: 'voice.webm',
          mimeType: 'audio/webm',
          language: 'zh',
          aiServiceUrl: AI_SERVICE_URL,
        })
        if (text) onTranscript(text)
        setRecording(false)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }

  const stopFallbackRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    // onstop 回调会处理后续转写
  }

  const toggle = () => {
    if (supported === 'native') {
      if (recording) {
        stopNativeRecording()
      } else {
        startNativeRecording()
      }
    } else if (supported === 'fallback') {
      if (recording) {
        stopFallbackRecording()
      } else {
        void startFallbackRecording()
      }
    }
  }

  if (supported === 'unsupported') return null

  return (
    <>
      <style>{`
        @keyframes voice-wave {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1); }
        }
      `}</style>
      <Tooltip content={recording ? t('voiceInputStop') : t('voiceInputStart')}>
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={recording ? t('voiceInputStop') : t('voiceInputStart')}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
            recording
              ? 'bg-red-500 text-white hover:bg-red-500/90'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {recording ? (
            <span className="flex h-4 items-center gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={`bar-${i}`}
                  className="w-0.5 rounded bg-white"
                  style={{
                    height: '100%',
                    transformOrigin: 'center',
                    animation: `voice-wave 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                  }}
                />
              ))}
            </span>
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
    </>
  )
}

export default VoiceInput
