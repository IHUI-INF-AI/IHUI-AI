// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VoiceInput — 浏览器扩展语音输入组件(零成本混合策略)。
 *
 * 2026-07-28 立:扩展端补齐语音输入能力,与 web 端共用 ai-service faster-whisper。
 *
 * 2026-09-01 反转优先级(对齐 web 端 2026-08-31 修复):
 * 主路径:MediaRecorder 录音 → POST ai-service /api/voice/stt(faster-whisper small 本地推理,
 *   零成本、国内可达)。Fallback(Firefox 无 MediaRecorder 时):浏览器原生 webkitSpeechRecognition。
 * 原因:原 native 主路径依赖 Google 语音服务器,国内不可达 → Chrome/Edge 点击必 onerror
 *   静默失败(无任何输出),与 web 旧版同款 bug。
 *
 * 与 web 端 voice-input.tsx 共用 packages/api-client 的 voiceSttFromBlob 封装。
 */
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../../src/i18n'
import { voiceSttFromBlob, VoiceSttHttpError } from '@ihui/api-client'
import { DEFAULT_AI_SERVICE_URL } from '../../../lib/config'
import { getToken } from '../../../lib/token'
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
  // 错误展示:登录过期/转写失败/未识别到内容等。
  // **2026-09-01 增加**(对齐 web 端):用 try/catch 区分错误类型而不是吞错。
  const [error, setError] = useState<string | null>(null)
  // 默认 fallback(本地转写优先);挂载后 effect 精确探测,无 MediaRecorder 才退回 native
  const [supported, setSupported] = useState<'native' | 'fallback' | 'unsupported'>('fallback')

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef('')

  // Fallback MediaRecorder 引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const nativeCtor =
      (typeof window !== 'undefined' &&
        (window.SpeechRecognition ?? window.webkitSpeechRecognition)) ||
      null
    const hasMediaRecorder =
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'

    // 2026-09-01 反转优先级:本地转写(fallback)优先。
    // 原 native(webkitSpeechRecognition)依赖 Google 语音服务器,国内不可达,
    // Chrome/Edge 点击必 onerror 静默失败(无输出),与 web 旧版同款 bug。
    // 本地 MediaRecorder → ai-service faster-whisper(small 模型)零成本、国内可用;
    // native 仅作为无 MediaRecorder 时的备选。
    if (hasMediaRecorder) {
      setSupported('fallback')
    } else if (nativeCtor) {
      setSupported('native')
      const recognition = new nativeCtor()
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

        // **2026-09-01 与 web 对齐**:try/catch 区分 VoiceSttHttpError/网络错误/成功空内容。
        let text: string
        try {
          text = await voiceSttFromBlob({
            blob: audioBlob,
            filename: 'voice.webm',
            mimeType: 'audio/webm',
            language: 'zh',
            aiServiceUrl: AI_SERVICE_URL,
            token: getToken() ?? undefined,
          })
        } catch (e) {
          if (e instanceof VoiceSttHttpError) {
            if (e.status === 401 || e.status === 403) {
              setError(t('chat.voiceUnauthorized') || '登录已过期,请刷新页面后重试')
            } else {
              setError(t('chat.voiceSttFailed') || '转写失败,请稍后重试或检查本地语音服务')
            }
          } else {
            setError(t('chat.voiceNetworkError') || '网络异常,请检查连接后重试')
          }
          setRecording(false)
          return
        }

        if (text) {
          onTranscript(text)
          setError(null)
        } else {
          // 后端 200 OK 但无内容 → 未识别到语音内容
          setError(t('chat.voiceEmpty') || '未识别到语音内容,请靠近麦克风后重试')
        }
        setRecording(false)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setError(null)
    } catch {
      setRecording(false)
      setError(t('chat.voiceError') || '无法访问麦克风,请在浏览器设置中允许麦克风权限')
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

  // **2026-09-01**:错误时显示 AlertTriangle 三角图标,tooltip 改为错误文案
  // (对齐 web 端行为;用户在 hover 时能看到具体原因)
  const buttonTitle = recording
    ? t('chat.voiceStop')
    : error
      ? error
      : t('chat.voiceStart')

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
                : error
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {error && !recording ? <AlertTriangle className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{buttonTitle}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default VoiceInput
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
