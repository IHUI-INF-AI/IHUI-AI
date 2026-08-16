/**
 * VoiceInput — 浏览器扩展语音输入组件(零成本混合策略)。
 *
 * 2026-07-28 立:扩展端补齐语音输入能力,与 web 端共用 ai-service faster-whisper。
 *
 * 主路径(Chrome/Edge):浏览器原生 webkitSpeechRecognition,零延迟零后端负载。
 * Fallback(Firefox):MediaRecorder 录音 → POST ai-service /api/voice/stt。
 *
 * 与 web 端 voice-input.tsx 共用 packages/api-client 的 voiceSttFromBlob 封装。
 */
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../src/i18n'
import { voiceSttFromBlob } from '@ihui/api-client'
import { DEFAULT_AI_SERVICE_URL } from '../../../lib/config'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@ihui/ui-react'

/** Mic 图标 SVG(extension 端不依赖 lucide-react,保持依赖精简)。 */
function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
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

// STT 地址单一来源:lib/config.ts 的 DEFAULT_AI_SERVICE_URL(与 host_permissions 的 8803 权限对应)
const AI_SERVICE_URL = DEFAULT_AI_SERVICE_URL

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const { t } = useI18n()
  const [recording, setRecording] = useState(false)
  const [supported, setSupported] = useState<'native' | 'fallback' | 'unsupported'>('native')

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef('')

  // Fallback MediaRecorder 引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const Ctor =
      (typeof window !== 'undefined' &&
        (window.SpeechRecognition ?? window.webkitSpeechRecognition)) ||
      null
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
      recognition.onerror = () => setRecording(false)
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
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [onTranscript])

  const startNative = () => {
    const r = recognitionRef.current
    if (!r) return
    transcriptRef.current = ''
    r.start()
    setRecording(true)
  }

  const stopNative = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const startFallback = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (audioBlob.size === 0) {
          setRecording(false)
          return
        }
        // 调用 packages/api-client 跨端共用封装
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

  const stopFallback = () => {
    const r = mediaRecorderRef.current
    if (r && r.state !== 'inactive') r.stop()
  }

  const toggle = () => {
    if (supported === 'native') {
      if (recording) stopNative()
      else startNative()
    } else if (supported === 'fallback') {
      if (recording) stopFallback()
      else void startFallback()
    }
  }

  if (supported === 'unsupported') return null

  const buttonTitle = recording ? t('chat.voiceStop') : t('chat.voiceStart')

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            aria-label={buttonTitle}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
              recording
                ? 'bg-red-500 text-white hover:bg-red-500/90'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <MicIcon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{buttonTitle}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default VoiceInput
