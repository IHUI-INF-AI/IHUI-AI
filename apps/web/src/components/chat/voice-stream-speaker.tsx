// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 语音朗读(P3 #46 阶段2,2026-09-17 立;2026-10-24 接逐段流 + 可打断)。
 *
 * VoiceStreamSpeaker:挂 AI 面板根部,订阅 chat store;开关开启时,流式结束
 * (done 边沿)把最终 assistant 回复交给 /api/voice/tts/stream(edge-tts,零 key)
 * 逐段合成、逐段播放。首帧 policy 里带「段间静默内可打断」的判据,客户端据此
 * 用 100ms 能量帧 VAD 在段尾静默余量里判起音,命中即 abort 传输层并停播后续段
 * (判据端口见文件下方 decideBargeIn;数字全部来自 policy,不在此另存一份)。
 * 开关关闭 / 无 policy 帧时保持旧行为:整段逐段播完,不做打断。
 *
 * VoicePlaybackToggle:输入工具栏的开关按钮,写 localStorage
 * ihui_voice_playback(默认 off)并广播自定义事件,Speaker 监听同步。
 */

import * as React from 'react'
import { AudioLines, Volume2, VolumeX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { IconButton } from '@ihui/ui-react'
import { refreshAccessTokenOnce } from '@ihui/api-client'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { useWebAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

export const VOICE_PLAYBACK_KEY = 'ihui_voice_playback'
const VOICE_PLAYBACK_EVENT = 'ihui-voice-playback-changed'
export const VOICE_HANDSFREE_KEY = 'ihui_voice_handsfree'
const VOICE_HANDSFREE_EVENT = 'ihui-voice-handsfree-changed'

/** 连续语音会话(P3 #46 阶段3-a):开 = 转写段落直接自动发送(免手,半双工:
 *  说 → 自动发 → 自动朗读;流式期间录音按钮按现状禁用,回复完再点麦继续) */
export function readHandsFree(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(VOICE_HANDSFREE_KEY) === 'on'
}
/** 单次朗读上限(字符),超长回复截断(朗读是辅助通道,全文用户可阅读) */
const SPEAK_MAX_CHARS = 3000

function readEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(VOICE_PLAYBACK_KEY) === 'on'
}

function getTtsEndpoint(): string {
  return typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_SERVICE_URL
    ? `${process.env.NEXT_PUBLIC_AI_SERVICE_URL}/voice/tts/stream`
    : '/api/voice/tts/stream'
}

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' 代码块略。 ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- 段间静默内可打断(D11 第二工客户端腿) ----
// 判据唯一事实源在服务端 app/core/voice_barge_in.py;这里只做逐行端口,窗口与
// 去抖数字全部从 /voice/tts/stream 的 policy 帧取,不另存一份常数。

const BARGE_IN_POLICY = 'silence_gap_only'

interface BargeInPolicy {
  policy: string
  frameHopMs: number
  minVoicedMs: number
  segmentLeadSilenceMs: number
  segmentTailSilenceMs: number
  voicedRmsThreshold: number
}

interface BargeInPlayback {
  playing: boolean
  nowMsIntoSegment: number
  segmentDurationMs: number
}

interface BargeInDecision {
  playing: boolean
  voicedMs: number
  nowMsIntoSegment: number
  segmentDurationMs: number
}

/** policy 帧 → 判据;字段缺失/非 silence_gap_only 返回 null(= 不武装 VAD、整段照播)。 */
function readBargeInPolicy(raw: unknown): BargeInPolicy | null {
  if (!raw || typeof raw !== 'object') return null
  const evt = raw as Record<string, unknown>
  if (evt.type !== 'policy' || evt.policy !== BARGE_IN_POLICY) return null
  const num = (key: string): number => {
    const value = evt[key]
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
  }
  const policy: BargeInPolicy = {
    policy: BARGE_IN_POLICY,
    frameHopMs: num('frameHopMs'),
    minVoicedMs: num('minVoicedMs'),
    segmentLeadSilenceMs: num('segmentLeadSilenceMs'),
    segmentTailSilenceMs: num('segmentTailSilenceMs'),
    voicedRmsThreshold: num('voicedRmsThreshold'),
  }
  if (
    !policy.frameHopMs ||
    !policy.minVoicedMs ||
    !policy.segmentTailSilenceMs ||
    !policy.voicedRmsThreshold
  ) {
    return null
  }
  return policy
}

/** 段内可判打断的时间窗(端口自 barge_in_window_ms,含段太短时的收缩)。 */
function bargeInWindowMs(policy: BargeInPolicy, segmentDurationMs: number): [number, number] {
  if (segmentDurationMs <= 0) return [0, 0]
  const lead = Math.min(policy.segmentLeadSilenceMs, segmentDurationMs)
  const tail = Math.min(policy.segmentTailSilenceMs, Math.max(0, segmentDurationMs - lead))
  return [segmentDurationMs - tail, segmentDurationMs]
}

/** 与 decide_barge_in 同判据(三条同时成立才打断,任一不成立一律 False)。 */
function decideBargeIn(policy: BargeInPolicy, decision: BargeInDecision): boolean {
  if (!decision.playing) return false
  if (decision.voicedMs < policy.minVoicedMs || decision.voicedMs > decision.nowMsIntoSegment)
    return false
  const [start, end] = bargeInWindowMs(policy, decision.segmentDurationMs)
  if (end <= 0) return false
  const runStart = decision.nowMsIntoSegment - decision.voicedMs
  return start <= runStart && decision.nowMsIntoSegment <= end
}

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

interface EnergyVadOptions {
  policy: BargeInPolicy
  getPlayback: () => BargeInPlayback | null
  onBargeIn: () => void
}

/**
 * VAD 采集必须开回声消除:AEC/NS/AGC 三项取 true。外放时麦克风会把自己播的
 * TTS 收进来,不开这些约束就会被判成"用户在段尾起音",误打断正在播的回复。
 * 这里只补采集约束,判据阈值仍只从服务端 policy 帧来。
 */
const VAD_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

/**
 * 取 VAD 采集流。个别实现不认识这三项约束会整条拒绝(Overconstrained /
 * NotSupported / TypeError):此时退回无约束 `{ audio: true }`,宁可少一层回声
 * 抑制也要保住"能判起音";其余错误(无权限/无设备)照旧上抛,由调用方静默降级。
 */
function requestVadStream(mediaDevices: MediaDevices): Promise<MediaStream> {
  return mediaDevices.getUserMedia({ audio: VAD_AUDIO_CONSTRAINTS }).catch((err: unknown) => {
    const name = (err as { name?: string } | null)?.name
    if (name === 'OverconstrainedError' || name === 'NotSupportedError' || name === 'TypeError') {
      return mediaDevices.getUserMedia({ audio: true })
    }
    throw err
  })
}

/**
 * 100ms 能量帧 VAD:复用录音栈同一条采集出口(getUserMedia → AudioContext),
 * 只读 RMS 判"有声帧",不录音不上传。拿不到麦克风/上下文时静默降级(整段播放)。
 * 返回停止函数;命中判据后自行停止并回调 onBargeIn。
 */
function startEnergyVad(options: EnergyVadOptions): () => void {
  if (typeof navigator === 'undefined') return () => {}
  const mediaDevices = navigator.mediaDevices
  const Ctx = getAudioContextCtor()
  if (!mediaDevices?.getUserMedia || !Ctx) return () => {}

  let stopped = false
  let stream: MediaStream | null = null
  let ctx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let voicedMs = 0
  const samples = new Float32Array(1024)

  const stop = (): void => {
    if (stopped) return
    stopped = true
    if (timer !== null) clearInterval(timer)
    timer = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    const current = ctx
    ctx = null
    analyser = null
    if (current) void current.close().catch(() => {})
  }

  void requestVadStream(mediaDevices)
    .then((mediaStream) => {
      if (stopped) {
        mediaStream.getTracks().forEach((track) => track.stop())
        return
      }
      stream = mediaStream
      try {
        const context = new Ctx()
        ctx = context
        const source = context.createMediaStreamSource(mediaStream)
        const node = context.createAnalyser()
        node.fftSize = 1024
        source.connect(node)
        analyser = node
      } catch {
        stop() // 采集上下文不可用:降级整段播放,不阻断主流程
        return
      }
      timer = setInterval(() => {
        if (!analyser) return
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i] ?? 0
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / samples.length)
        const playback = options.getPlayback()
        if (!playback || !playback.playing) {
          voicedMs = 0
          return
        }
        voicedMs =
          rms >= options.policy.voicedRmsThreshold ? voicedMs + options.policy.frameHopMs : 0
        if (
          decideBargeIn(options.policy, {
            playing: playback.playing,
            voicedMs,
            nowMsIntoSegment: playback.nowMsIntoSegment,
            segmentDurationMs: playback.segmentDurationMs,
          })
        ) {
          stop()
          options.onBargeIn()
        }
      }, options.policy.frameHopMs)
    })
    .catch(() => {
      /* 无权限/无设备:静默降级为整段播放 */
    })

  return stop
}

interface SegmentEvent {
  type: 'segment'
  index: number
  total: number
  text: string
  contentType: string
  audioBase64: string
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer as ArrayBuffer
}

/** 朗读开关按钮(输入工具栏) */
export function VoicePlaybackToggle({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('chat')
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    setEnabled(readEnabled())
    const sync = () => setEnabled(readEnabled())
    window.addEventListener(VOICE_PLAYBACK_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(VOICE_PLAYBACK_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const toggle = () => {
    const next = !readEnabled()
    if (next === false) {
      // 关闭时停掉正在播的音频
      window.dispatchEvent(new CustomEvent(VOICE_PLAYBACK_EVENT))
    }
    window.localStorage.setItem(VOICE_PLAYBACK_KEY, next ? 'on' : 'off')
    window.dispatchEvent(new Event(VOICE_PLAYBACK_EVENT))
  }

  return (
    <IconButton
      onClick={toggle}
      disabled={disabled}
      aria-pressed={enabled}
      aria-label={enabled ? t('voicePlaybackOn') : t('voicePlaybackOff')}
      data-testid="voice-playback-toggle"
      className={cn(enabled && 'bg-primary/10 text-primary hover:bg-primary/20')}
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </IconButton>
  )
}

/** 连续对话开关按钮(输入工具栏) */
export function VoiceHandsFreeToggle({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('chat')
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    setEnabled(readHandsFree())
    const sync = () => setEnabled(readHandsFree())
    window.addEventListener(VOICE_HANDSFREE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(VOICE_HANDSFREE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const toggle = () => {
    const next = !readHandsFree()
    window.localStorage.setItem(VOICE_HANDSFREE_KEY, next ? 'on' : 'off')
    window.dispatchEvent(new Event(VOICE_HANDSFREE_EVENT))
  }

  return (
    <IconButton
      onClick={toggle}
      disabled={disabled}
      aria-pressed={enabled}
      aria-label={enabled ? t('voiceHandsFreeOn') : t('voiceHandsFreeOff')}
      data-testid="voice-handsfree-toggle"
      className={cn(enabled && 'bg-primary/10 text-primary hover:bg-primary/20')}
    >
      <AudioLines />
    </IconButton>
  )
}

/** 流式完成自动朗读(挂 AI 面板根部,自身无 UI) */
export function VoiceStreamSpeaker() {
  // 票60 长尾(2026-10-21):朗读腿随输入框进非根窗格 ⇒ 播的是本窗格那次流式,不是根窗格的
  const chatStore = usePaneChatStore()
  const isStreaming = chatStore((s) => s.isStreaming)
  // 2026-10-26:这里**不再**订阅 token(旧写法把 render 期那一枚带进 15 分钟后仍照发),
  // 改为建连时 useWebAuthStore.getState() 现取,见下方 speakStream。
  // 只订阅叶子值:最后一条 assistant 内容(字符串引用稳定)
  const content = chatStore((s) => {
    const msgs = s.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (msg && msg.role === 'assistant') return msg.content ?? ''
    }
    return ''
  })
  const wasStreamingRef = React.useRef(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  /**
   * 与 audioRef 同生命周期的 object URL 句柄。
   *
   * 立因:本文件此前是全仓 39 个 `createObjectURL` 落点里**唯一**一个有 create 无
   * revoke 的(`git grep -l` 两面差集实测),而 TTS 播报是"每轮回答播一次"的高频
   * 动作 —— 每次合成都往进程的 blob 表里永久压一条 URL 和它引用的整个音频 Blob,
   * 长会话即持续涨内存。这里用一个 ref 而不是从 `audioRef.current.src` 反解:
   * revoke 必须发生在 pause 之后,而那时 src 字符串未必还指向有效对象。
   */
  const objectUrlRef = React.useRef<string | null>(null)
  /** 当前播报会话的传输层句柄:打断 = abort 它,服务端随之取消尚未合成的段 */
  const abortRef = React.useRef<AbortController | null>(null)
  /** 当前会话的能量帧 VAD 停止函数(policy 到达才武装) */
  const stopVadRef = React.useRef<(() => void) | null>(null)
  /** 当前正在播的段及其进度(判打断的唯一可观测事实) */
  const playbackRef = React.useRef<BargeInPlayback | null>(null)

  const releaseObjectUrl = React.useCallback((): void => {
    if (objectUrlRef.current !== null) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  // 卸载/关闭开关/命中打断时停止播放
  const stopPlayback = React.useCallback((): void => {
    abortRef.current?.abort()
    abortRef.current = null
    stopVadRef.current?.()
    stopVadRef.current = null
    playbackRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    // 停播即释放:提前 return、关掉开关、组件卸载三条路都收敛到这里
    releaseObjectUrl()
  }, [releaseObjectUrl])

  React.useEffect(() => {
    if (!readEnabled()) {
      stopPlayback()
    }
    const onStop = () => stopPlayback()
    window.addEventListener(VOICE_PLAYBACK_EVENT, onStop)
    return () => {
      window.removeEventListener(VOICE_PLAYBACK_EVENT, onStop)
      stopPlayback()
    }
  }, [stopPlayback])

  React.useEffect(() => {
    // done 边沿:流式从 true → false
    if (isStreaming || !wasStreamingRef.current) {
      wasStreamingRef.current = isStreaming
      return
    }
    wasStreamingRef.current = false
    if (!readEnabled()) return
    const speech = stripMarkdownForSpeech(content).slice(0, SPEAK_MAX_CHARS)
    if (!speech) return

    stopPlayback() // 先收掉上一轮(含仍在播的段)
    const controller = new AbortController()
    abortRef.current = controller
    const isLive = (): boolean => !controller.signal.aborted

    // 段内播放:串行队列保证"上一段播完才起下一段",段间静默就是可打断窗口。
    // handedOff 标记"句柄已交给 <audio>,释放权归 ended / error / stopPlayback";
    // 未交接成功前(含 new Audio 抛错)由下面的 finally 就地释放。
    const playSegment = async (evt: SegmentEvent): Promise<void> => {
      if (!isLive()) return
      const blob = new Blob([base64ToBytes(evt.audioBase64)], {
        type: evt.contentType || 'audio/mpeg',
      })
      const objectUrl = URL.createObjectURL(blob)
      let handedOff = false
      try {
        if (!isLive()) return
        const audio = new Audio(objectUrl)
        handedOff = true
        objectUrlRef.current = objectUrl
        audioRef.current = audio
        let playback: BargeInPlayback | null = null
        let resolveEnded: () => void = () => {}
        const ended = new Promise<void>((resolve) => {
          resolveEnded = resolve
        })
        const onEnd = (): void => {
          // 段一结束立刻撤掉判据观测点:下一段还没开始,不能在边界上误判打断
          if (playback && playbackRef.current === playback) playbackRef.current = null
          if (objectUrlRef.current === objectUrl) releaseObjectUrl()
          resolveEnded()
        }
        audio.addEventListener('ended', onEnd)
        audio.addEventListener('error', onEnd)
        const played = await audio
          .play()
          .then(() => true)
          .catch(() => false)
        if (!played || !isLive()) {
          // 自动播放被策略拦截 / 会话已中止:释放本段句柄,后续段由 isLive 拦住
          if (objectUrlRef.current === objectUrl) releaseObjectUrl()
          return
        }
        playback = {
          playing: true,
          get nowMsIntoSegment() {
            return Math.round(audio.currentTime * 1000)
          },
          get segmentDurationMs() {
            return Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0
          },
        }
        playbackRef.current = playback
        await ended
        if (playback && playbackRef.current === playback) playbackRef.current = null
      } finally {
        if (!handedOff) URL.revokeObjectURL(objectUrl)
      }
    }

    let playChain: Promise<void> = Promise.resolve()
    const enqueueSegment = (evt: SegmentEvent): void => {
      playChain = playChain.then(() => playSegment(evt)).catch(() => {})
    }

    const handleEvent = (line: string): void => {
      let evt: unknown
      try {
        evt = JSON.parse(line)
      } catch {
        return // 坏帧跳过,不拖垮整条播报
      }
      if (!evt || typeof evt !== 'object') return
      const type = (evt as { type?: unknown }).type
      if (type === 'policy') {
        const policy = readBargeInPolicy(evt)
        if (!policy) return // off / 字段不全:不武装 VAD,整段照播
        stopVadRef.current?.()
        stopVadRef.current = startEnergyVad({
          policy,
          getPlayback: () => playbackRef.current,
          onBargeIn: () => {
            controller.abort() // 传输层取消:服务端不再合成后续段
            stopPlayback() // 停当前声 + 停 VAD + 释放句柄
          },
        })
        return
      }
      if (type === 'segment') enqueueSegment(evt as SegmentEvent)
    }

    const speakStream = async (): Promise<void> => {
      // 凭据每次建连现取:render 期订阅到的那一枚可能已经躺了超过 15 分钟(access 寿命)。
      const openOnce = (): Promise<Response> => {
        const credential = useWebAuthStore.getState().token
        return fetch(getTtsEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
          },
          body: JSON.stringify({ text: speech, voice: 'zh-CN-XiaoxiaoNeural' }),
          signal: controller.signal,
        })
      }
      try {
        let res = await openOnce()
        // 401 = access 过期。整轮播报至多续期一次并重放一次(HTTP 层尚未读任何音频帧,
        // 重放不会播两遍);续期失败或重放仍非 2xx ⇒ 走下面的可见报错出口,不再重试。
        // 红线:这里不做任何登出动作(判不出/网络抖动都不是会话终结)。
        if (res.status === 401) {
          const fresh = await refreshAccessTokenOnce()
          if (fresh && !controller.signal.aborted) res = await openOnce()
        }
        if (!isLive()) return
        if (!res.ok || !res.body) {
          // 立因修复:此前 401(以及一切非 2xx)被下面的空 catch 吞掉 ⇒ 用户只看到
          // "就是没声音",而界面/控制台零线索。朗读是辅助通道可以不响用户,
          // 但不能**连日志都不响**(§5e:失败必须响)。
          console.error(
            `[voice-stream-speaker] TTS stream failed: HTTP ${res.status}${
              res.status === 401 ? ' (auth-refresh-exhausted)' : ''
            }`,
          )
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })
          let cut = buffer.indexOf('\n')
          while (cut >= 0) {
            const line = buffer.slice(0, cut)
            buffer = buffer.slice(cut + 1)
            if (line.trim()) handleEvent(line)
            cut = buffer.indexOf('\n')
          }
        }
        if (buffer.trim()) handleEvent(buffer)
        await playChain
      } catch (err) {
        // abort(用户打断/切走/卸载)= 预期内静默;其余(网络异常、读环抛错)**必须响** ——
        // 空 catch 把"整条 TTS 挂了"读成"这轮没有语音",是 §12f 那条"失效总是安静的"的现场。
        if (controller.signal.aborted) return
        console.error('[voice-stream-speaker] TTS stream failed', err)
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
          stopVadRef.current?.()
          stopVadRef.current = null
          playbackRef.current = null
        }
      }
    }
    void speakStream()

    return () => {
      if (abortRef.current === controller) {
        abortRef.current = null
        controller.abort()
        stopVadRef.current?.()
        stopVadRef.current = null
        playbackRef.current = null
      }
    }
    // content 在 done 边沿已是终值;仅以 isStreaming 变化驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  return null
}

export default VoiceStreamSpeaker
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
