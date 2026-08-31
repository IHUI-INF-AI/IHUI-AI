// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Mic, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { voiceSttFromBlob } from '@ihui/api-client'
import { useWebAuthStore } from '@/stores/auth-store'

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
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>
      }) => void)
    | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

// STT 端点策略:
// - 显式配置 NEXT_PUBLIC_AI_SERVICE_URL(静态导出/直连场景)→ 用它直连 ai-service(带 Bearer token)
// - 默认(dev + 生产服务端模式)→ 同源 /api/voice/stt,由 next rewrites 代理到 8803,
//   避免浏览器直连 8803 的跨端口/CORS/鉴权问题
const STT_ENDPOINT =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_SERVICE_URL
    ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
    : '/api/voice/stt'

function getRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

function hasMediaRecorder(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

type VoiceMode = 'native' | 'fallback' | 'unsupported'

/**
 * VoiceInput — 语音输入组件(零成本混合策略)。
 *
 * 路径一(fallback,默认优先):MediaRecorder 录音 → 同源 /api/voice/stt(next rewrites
 *   代理到 ai-service)→ faster-whisper 本地 CPU 推理(完全免费,首次下载 74MB 模型后离线)。
 *   - 2026-08-31 修复:请求携带 Bearer access token(ai-service 已启用 JWT 鉴权,
 *     无 token 直连必 401),失败时展示错误提示而非静默丢弃。
 *   - 2026-08-31 调整:本地转写改为默认路径。原默认的浏览器原生识别依赖 Google
 *     语音服务器,国内网络不可达,点击后必触发 onerror 显示错误三角——用户感知
 *     即"点一下就报错"。反转优先级后一次点击直达可用路径,native 仅作备选。
 *
 * 路径二(native,备选):浏览器 webkitSpeechRecognition(需 Google 服务可达)。
 *   - 仅当浏览器不支持 MediaRecorder 时才启用。
 *   - continuous=false:说完一句话自动结束并回调,无需手动点停止。
 *   - onresult 只累加 isFinal 结果,修复 continuous 模式 results 累积导致的文本重复。
 *
 * 两条路径最终都调用 onTranscript(text),由父组件决定如何处理(通常追加到 textarea)。
 */
export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const t = useTranslations('chat')
  const accessToken = useWebAuthStore((s) => s.token)
  const [mode, setMode] = React.useState<VoiceMode>('native')
  const [recording, setRecording] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // 用 ref 持有最新回调,避免父组件每次渲染传入新函数导致 effect 反复重建(中断录音)
  const onTranscriptRef = React.useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = React.useRef('')

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)

  // 挂载时探测能力:本地转写(MediaRecorder→faster-whisper)优先;
  // 浏览器原生识别依赖 Google 语音服务器(国内不可达),仅作无 MediaRecorder 时的备选
  React.useEffect(() => {
    if (hasMediaRecorder()) {
      setMode('fallback')
    } else if (getRecognitionConstructor()) {
      setMode('native')
    } else {
      setMode('unsupported')
    }
    return () => {
      // 卸载时清理:停识别器、停录音轨道
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  /** 构建原生识别器(供每次 start 前重建,避免复用已 end 的实例)。 */
  const createNativeRecognition = React.useCallback(() => {
    const Ctor = getRecognitionConstructor()
    if (!Ctor) return null
    const recognition = new Ctor()
    recognition.lang = 'zh-CN'
    // continuous=false:说完自动 end → onend 回调,无需用户手动停止
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      // 只累加 isFinal 结果:continuous 模式下 event.results 是累积快照,
      // 若遍历全部结果拼接会产生大量重复文本(fixed 2026-08-31)
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i]
        if (r?.[0]?.transcript && (r.isFinal || event.results.length - 1 === i)) {
          text += r[0].transcript
        }
      }
      if (text) transcriptRef.current = text
    }
    recognition.onerror = () => {
      // Google 语音服务不可达(国内网络常见)→ 自动降级本地 STT
      setRecording(false)
      if (hasMediaRecorder()) {
        setMode('fallback')
        setError(t('voiceInputNativeFallback') || '浏览器语音服务不可用,已切换本地转写,请重试')
      } else {
        setError(t('voiceInputError') || '语音识别不可用,请检查网络或换用 Chrome/Edge')
      }
    }
    recognition.onend = () => {
      setRecording(false)
      recognitionRef.current = null
      const text = transcriptRef.current
      transcriptRef.current = ''
      if (text) onTranscriptRef.current(text)
    }
    return recognition
  }, [t])

  const startNativeRecording = () => {
    const recognition = createNativeRecognition()
    if (!recognition) return
    recognitionRef.current = recognition
    transcriptRef.current = ''
    setError(null)
    try {
      recognition.start()
      setRecording(true)
    } catch {
      setError(t('voiceInputError') || '语音识别启动失败,请重试')
    }
  }

  const stopNativeRecording = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
  }

  const startFallbackRecording = async () => {
    try {
      setError(null)
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
        mediaRecorderRef.current = null

        if (audioBlob.size === 0) {
          setRecording(false)
          return
        }

        const text = await voiceSttFromBlob({
          blob: audioBlob,
          filename: 'voice.webm',
          mimeType: 'audio/webm',
          language: 'zh',
          aiServiceUrl: STT_ENDPOINT,
          token: accessToken ?? undefined,
        })
        if (text) {
          onTranscriptRef.current(text)
          setError(null)
        } else if (audioBlob.size < 2000) {
          setError(t('voiceInputEmpty') || '未识别到语音内容,请靠近麦克风后重试')
        } else {
          setError(t('voiceInputSttFailed') || '转写失败,请稍后重试或检查本地语音服务')
        }
        setRecording(false)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setRecording(false)
      setError('无法访问麦克风,请在浏览器设置中允许麦克风权限')
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
    if (recording) {
      if (mode === 'native') stopNativeRecording()
      else stopFallbackRecording()
      return
    }
    setError(null)
    if (mode === 'native') {
      startNativeRecording()
    } else if (mode === 'fallback') {
      void startFallbackRecording()
    }
  }

  if (mode === 'unsupported') return null

  return (
    <>
      <style>{`
        @keyframes voice-wave {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1); }
        }
      `}</style>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip content={error ?? (recording ? t('voiceInputStop') : t('voiceInputStart'))}>
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            aria-label={recording ? t('voiceInputStop') : (error ?? t('voiceInputStart'))}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
              recording
                ? 'bg-red-500 text-white hover:bg-red-500/90'
                : error
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
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
            ) : error ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
      </div>
    </>
  )
}

export default VoiceInput
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
