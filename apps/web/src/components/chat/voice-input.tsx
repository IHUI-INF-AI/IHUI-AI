// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Mic, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { voiceSttFromBlob, VoiceSttHttpError } from '@ihui/api-client'
import { useWebAuthStore } from '@/stores/auth-store'
// D62(G-76):麦克风错误的四类归一判据一律走共享层,端内不得再写 if/switch 分类
import {
  classifyMicError,
  micErrorTitleKey,
  type MicErrorKind,
} from '@ihui/shared/chat/voice-subtitles'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  /** 2026-09-18 整合:VoiceToolbar 接管录音按钮 UI 后,VoiceInput 只需保留识别
   *  逻辑;传 true 则不渲染任何按钮/徽章,只通过 forwardRef 暴露 recording/pending/toggle。 */
  hidden?: boolean
}

/**
 * 暴露给 VoiceToolbar 消费的接口(2026-09-18 整合):
 * 三个语音按钮(录音 / 自动朗读 / 连续对话)已合并为单一 dropdown,
 * VoiceToolbar 需要读 recording 状态显示主按钮 UI,需要读 pendingSegments 显示转写中徽章,
 * 需要调用 toggleRecording 触发录音开始/停止。
 */
export interface VoiceInputHandle {
  readonly recording: boolean
  readonly pendingSegments: number
  /** D62:classifyMicError 归一后的四类麦克风错误(null = 无错误),供宿主 VoiceToolbar 渲染字幕条 */
  readonly micError: MicErrorKind | null
  toggleRecording: () => void
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
/**
 * VoiceInput — 语音输入组件(零成本混合策略)。
 *
 * 2026-09-18 整合:通过 React.forwardRef 暴露 VoiceInputHandle 供 VoiceToolbar 桥接
 * recording/pending/toggle;传 hidden 可关闭渲染只保留识别逻辑。
 */
function VoiceInputBase(
  { onTranscript, disabled, hidden }: VoiceInputProps,
  ref: React.ForwardedRef<VoiceInputHandle | null>,
) {
  const t = useTranslations('chat')
  // D62:四类麦克风错误文案的唯一词包位(ai.pane.voiceSubtitles.micError.<kind>,五语齐备)
  const tv = useTranslations('ai.pane.voiceSubtitles')
  const accessToken = useWebAuthStore((s) => s.token)
  const [mode, setMode] = React.useState<VoiceMode>('native')
  const [recording, setRecording] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [micErrorKind, setMicErrorKind] = React.useState<MicErrorKind | null>(null)

  /** 麦克风启动类失败的统一落点:异常 → classifyMicError 归一四类 → 各类各自文案。 */
  const applyMicFailure = React.useCallback(
    (e: unknown) => {
      const kind = classifyMicError(e)
      setMicErrorKind(kind)
      setError(tv(micErrorTitleKey(kind)))
    },
    [tv],
  )

  // 用 ref 持有最新回调,避免父组件每次渲染传入新函数导致 effect 反复重建(中断录音)
  const onTranscriptRef = React.useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = React.useRef('')

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
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
    setMicErrorKind(null)
    try {
      recognition.start()
      setRecording(true)
    } catch (e) {
      // D62:识别器启动异常同样走四类归一(AbortError/未知 → startFailed 兜底)
      applyMicFailure(e)
    }
  }

  const stopNativeRecording = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
  }

  // ---------------------------------------------------------------------------
  // P3 #46 阶段1(2026-09-17 立):实时转写。
  // 原实现:停止后把全部 chunks 合成一个整段才转写 → 说 30s 要等 30s 后才出字。
  // 现实现:MediaRecorder.start(2500) 每 2.5s 产一个分段,串行队列逐段上传
  // /api/voice/stt(保序),每段结果即追加到输入框(边说边出字)。
  // 复用既有 faster-whisper 端点,零后端改动;段间边界词重复为分段转写固有的
  // 权衡(换实时性);停止时等队列清空才回弹按钮,防丢尾段。
  // ---------------------------------------------------------------------------
  const SEGMENT_MS = 2500

  const segQueueRef = React.useRef<{ seq: number; blob: Blob }[]>([])
  const nextSeqRef = React.useRef(0)
  const pumpingRef = React.useRef(false)
  const flushStopRef = React.useRef(false)
  const segDoneRef = React.useRef(0)
  const segFailRef = React.useRef(0)
  const [pendingSegments, setPendingSegments] = React.useState(0)

  const syncPending = () => {
    setPendingSegments(segQueueRef.current.length + (pumpingRef.current ? 1 : 0))
  }

  /** 串行泵:按 seq 顺序转写队列中的分段,全部完成后按需收尾 */
  const pumpSegments = async () => {
    if (pumpingRef.current) return
    pumpingRef.current = true
    syncPending()
    try {
      for (;;) {
        const seg = segQueueRef.current[0]
        if (!seg) break
        segQueueRef.current.shift()
        syncPending()
        if (seg.blob.size === 0) {
          segDoneRef.current++
          continue
        }
        try {
          const text = await voiceSttFromBlob({
            blob: seg.blob,
            filename: `voice-seg-${seg.seq}.webm`,
            mimeType: 'audio/webm',
            language: 'zh',
            aiServiceUrl: STT_ENDPOINT,
            token: accessToken ?? undefined,
          })
          segDoneRef.current++
          if (text) {
            setError(null)
            setMicErrorKind(null)
            onTranscriptRef.current(text)
          }
        } catch (e) {
          segFailRef.current++
          // 单段失败不中断整次输入;401/403 提示登录过期,其余静默续传
          if (e instanceof VoiceSttHttpError && (e.status === 401 || e.status === 403)) {
            setError(t('voiceInputUnauthorized') || '登录已过期,请刷新页面后重试')
          }
        }
      }
    } finally {
      pumpingRef.current = false
      syncPending()
      // 停止指令已下且队列清空 → 收尾(释放麦克风/回弹按钮/空内容判定)
      if (flushStopRef.current && segQueueRef.current.length === 0 && !pumpingRef.current) {
        flushStopRef.current = false
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        mediaRecorderRef.current = null
        setRecording(false)
        if (segDoneRef.current === 0 && segFailRef.current === 0) {
          setError(t('voiceInputEmpty') || '未识别到语音内容,请靠近麦克风后重试')
        } else if (segFailRef.current > 0 && segDoneRef.current === 0) {
          setError(t('voiceInputSttFailed') || '转写失败,请稍后重试或检查本地语音服务')
        }
      }
    }
  }

  const startFallbackRecording = async () => {
    try {
      setError(null)
      setMicErrorKind(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      segQueueRef.current = []
      nextSeqRef.current = 0
      segDoneRef.current = 0
      segFailRef.current = 0
      flushStopRef.current = false
      recorder.ondataavailable = (e) => {
        if (e.data.size <= 0) return
        // 忽略停止后迟到的分段(队列已收尾就不再追加)
        if (flushStopRef.current && segQueueRef.current.length === 0 && !pumpingRef.current) return
        const seq = nextSeqRef.current++
        segQueueRef.current.push({ seq, blob: e.data })
        void pumpSegments()
      }
      recorder.onstop = () => {
        // 最后一个分段可能还在路上:标记 flush,pump 收尾;若队列已空直接收尾
        flushStopRef.current = true
        void pumpSegments()
      }
      recorder.start(SEGMENT_MS)
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch (e) {
      // D62:不再把所有异常糊成一条笼统文案 —— getUserMedia 的 DOMException 名
      // 交 classifyMicError 归一为 无权限/无设备/被占用/启动失败 四类,各自文案。
      setRecording(false)
      applyMicFailure(e)
    }
  }

  const stopFallbackRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      // onstop → flush 标记 → 队列清空后由 pumpSegments 收尾回弹
    }
  }

  const toggle = () => {
    if (recording) {
      if (mode === 'native') stopNativeRecording()
      else stopFallbackRecording()
      return
    }
    setError(null)
    setMicErrorKind(null)
    if (mode === 'native') {
      startNativeRecording()
    } else if (mode === 'fallback') {
      void startFallbackRecording()
    }
  }

  // 2026-09-18 整合:VoiceToolbar 通过 forwardRef 读取 recording/pending 状态并调用 toggle。
  // 用 ref 镜像最新值,避免 toggle 未 useCallback 时 deps 每轮变化;hook 顺序稳定(在 return 之前)。
  const handleRef = React.useRef<{
    recording: boolean
    pendingSegments: number
    micError: MicErrorKind | null
    toggle: () => void
  }>({
    recording: false,
    pendingSegments: 0,
    micError: null,
    toggle: () => {},
  })
  handleRef.current.recording = recording
  handleRef.current.pendingSegments = pendingSegments
  handleRef.current.micError = micErrorKind
  handleRef.current.toggle = toggle
  React.useImperativeHandle(
    ref,
    () => ({
      get recording() {
        return handleRef.current.recording
      },
      get pendingSegments() {
        return handleRef.current.pendingSegments
      },
      get micError() {
        return handleRef.current.micError
      },
      toggleRecording: () => {
        handleRef.current.toggle()
      },
    }),
    [],
  )

  if (mode === 'unsupported' || hidden) return null

  return (
    <>
      <style>{`
        @keyframes voice-wave {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1); }
        }
      `}</style>
      <div className="flex shrink-0 items-center gap-1">
        {pendingSegments > 0 && (
          <span
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            data-testid="voice-live-pending"
          >
            {t('voiceInputPending', { count: pendingSegments })}
          </span>
        )}
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

/**
 * forwardRef 包装:让 VoiceInput 作为 <VoiceInput ref={...}> 使用时可接收 ref 并桥接 VoiceInputHandle。
 */
export const VoiceInput = React.forwardRef(
  VoiceInputBase as React.ForwardRefExoticComponent<
    VoiceInputProps & React.RefAttributes<VoiceInputHandle | null>
  >,
)
VoiceInput.displayName = 'VoiceInput'

export default VoiceInput
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
