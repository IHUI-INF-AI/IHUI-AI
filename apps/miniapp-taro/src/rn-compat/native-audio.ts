// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-audio.ts —— `expo-audio` 在小程序端的**等价实现**(录音 = RecorderManager,播放 = InnerAudioContext)。
 *
 * 为什么必须补(2026-10-26 就绪尺与造页器现读):`expo-audio` 的包入口发的是未编译 TS,weapp 侧 webpack
 * 不转译 node_modules 的 .ts ⇒ 引用它的 RN 壳(AgentChatScreen 经 `components/VoiceInput.tsx`、
 * HomeScreen 经 `hooks/use-voice-recorder.ts`)闭包里一出现就 `ModuleParseError`,整轮构建停摆。
 * 而这些壳正是"小程序复用 RN 屏"要直渲的那批 ⇒ 这一格只能在这里承,不能逐屏重写。
 *
 * 消费面(现读穷举,不是想象):
 *   · `useAudioRecorder(preset)` → `record()` / `await stop()` / `await prepareToRecordAsync()` / `uri`
 *     (apps/mobile-rn/src/hooks/use-voice-recorder.ts、components/VoiceInput.tsx、hooks/useChatInput.ts)
 *   · `useAudioPlayer(src)` → `play()` / `pause()` / `seekTo(s)` / `replace(uri)`;
 *     `useAudioPlayerStatus(player)` → `playing` / `duration` / `currentTime`
 *     (components/VoiceBubble.tsx、screens/ProfileScreen.tsx、screens/ChatScreen.tsx 的 TTS 链)
 *   · `AudioModule.requestRecordingPermissionsAsync()` → `{ granted }`;`setAudioModeAsync({...})`
 *
 * 语义对照与降级(逐处点名,不静默):
 *   · 容器差异:RN 侧 HIGH_QUALITY 发的是 m4a(AAC in MP4),微信 RecorderManager 发的是 **ADTS AAC**。
 *     后端 `apps/api/src/utils/file-type-validator.ts` 的音频白名单里 `aac`(audio/aac / audio/aacp)
 *     与 `m4a` 分列两档 ⇒ 这里落 `aac` 并按该档自证,不冒充 m4a。
 *   · `setAudioModeAsync`:`playsInSilentMode` / `allowsRecording` 是 iOS/Android 音频会话档,小程序
 *     由平台音频上下文负责(无对应全局设置)⇒ 空实现但告警一次,调用方的 await 不挂。
 *   · 录音权限:`scope.record` 授权失败 ⇒ `{ granted:false }`,与 RN 侧被拒时的返回同形,
 *     调用方本就按"未授权则不录"分支处理。
 *   · `stop()` 的兑现:微信 onStop 在"没录到东西"时可能不回 ⇒ 加 3s 兜底 resolve(uri 留空串),
 *     因为调用方是 `await recorder.stop()` 后读 `recorder.uri ?? ''` —— 挂住等于整条语音输入卡死。
 *   · RecorderManager 在微信侧是**单例**:事件只接一次并派发给"当前持有录音权的那一枚",
 *     两枚 recorder 同时 record 时后起的显式告警并接管,不静默串音。
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import Taro from '@tarojs/taro'

const warned = new Set<string>()
function warnOnce(id: string, message: string): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rn-compat] ${message}`)
}

/** 与 RN 侧同名同位的预设档(本端真实采样参数见 START_OPTIONS,preset 只按"调用方选了哪档"保留) */
export const RecordingPresets = {
  HIGH_QUALITY: { android: { isAudioOnly: true }, ios: { isAudioOnly: true } },
  BASIC: { android: { isAudioOnly: false }, ios: { isAudioOnly: false } },
}

const START_OPTIONS = {
  duration: 600000,
  // Taro 侧这两档的键在类型里是数字字面量(SampleRate = 8000|11025|…|48000、NumberOfChannels = 1|2),
  // 而 keyof 取到的是"键名联合"⇒ 跨不过去,只能 unknown 过一道;值本身按平台文档的合法档取。
  sampleRate: 44100 as unknown as keyof Taro.RecorderManager.SampleRate,
  numberOfChannels: 1 as unknown as keyof Taro.RecorderManager.NumberOfChannels,
  encodeBitRate: 192000,
  // 容器自证:微信 recorder 的 aac = ADTS AAC(后端 apps/api/src/utils/file-type-validator.ts 的 audio/aac 档)
  format: 'aac' as keyof Taro.RecorderManager.Format,
} satisfies Taro.RecorderManager.StartOption

export type AudioPermissionResult = {
  granted: boolean
  canAskAgain: boolean
  expires: 'never' | 'thisLaunch' | 'session'
  status: 'granted' | 'denied' | 'undetermined'
}

async function requestRecordingPermissionsAsync(): Promise<AudioPermissionResult> {
  try {
    await Taro.authorize({ scope: 'scope.record' })
    return { granted: true, canAskAgain: false, expires: 'never', status: 'granted' }
  } catch {
    // 被拒过一次的,微信不再弹框 ⇒ canAskAgain 取决于 authSetting 里该 scope 是否有明确 false
    let canAskAgain = true
    try {
      const setting = await Taro.getSetting()
      canAskAgain = setting?.authSetting?.['scope.record'] !== false
    } catch {
      /* 读不到设置面 ⇒ 按"还能再问"处理(失效方向是多要一次授权,不是少要) */
    }
    return { granted: false, canAskAgain, expires: 'never', status: 'denied' }
  }
}

async function getRecordingPermissionsAsync(): Promise<AudioPermissionResult> {
  try {
    const setting = await Taro.getSetting()
    const granted = setting?.authSetting?.['scope.record'] === true
    return {
      granted,
      canAskAgain: setting?.authSetting?.['scope.record'] !== false,
      expires: 'never',
      status: granted ? 'granted' : 'undetermined',
    }
  } catch {
    return { granted: false, canAskAgain: true, expires: 'never', status: 'undetermined' }
  }
}

export async function setAudioModeAsync(): Promise<void> {
  warnOnce(
    'audio-mode',
    'expo-audio.setAudioModeAsync 的 playsInSilentMode/allowsRecording 在小程序无对应全局档(平台音频上下文自管)⇒ 本轮不生效',
  )
}

export const AudioModule = {
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
}

// ---------- 播放:InnerAudioContext ----------

export type AudioPlayerStatus = {
  playing: boolean
  paused: boolean
  currentTime: number
  duration: number
  muted: boolean
  volume: number
}

export interface AudioPlayer {
  readonly status: AudioPlayerStatus
  subscribe(listener: () => void): () => void
  play(): Promise<void>
  pause(): void
  stop(): void
  seekTo(seconds: number): void
  replace(sourceUri: string): void
  setVolume(volume: number): void
  setMuted(muted: boolean): void
  destroy(): void
}

class MiniAudioPlayer implements AudioPlayer {
  private ctx: Taro.InnerAudioContext | null = null
  private readonly listeners = new Set<() => void>()
  private snap: AudioPlayerStatus = {
    playing: false,
    paused: false,
    currentTime: 0,
    duration: 0,
    muted: false,
    volume: 1,
  }
  private sourceUri = ''
  private lastVolume = 1

  constructor(source: string | null | undefined) {
    if (source) this.replace(source)
  }

  get status(): AudioPlayerStatus {
    return this.snap
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private commit(patch: Partial<AudioPlayerStatus>): void {
    this.snap = { ...this.snap, ...patch }
    for (const listener of [...this.listeners]) listener()
  }

  private ensure(): Taro.InnerAudioContext {
    if (this.ctx) return this.ctx
    const ctx = Taro.createInnerAudioContext()
    ctx.onPlay?.(() => this.commit({ playing: true, paused: false }))
    ctx.onPause?.(() => this.commit({ playing: false, paused: true }))
    ctx.onStop?.(() => this.commit({ playing: false, paused: false, currentTime: 0 }))
    ctx.onEnded?.(() => this.commit({ playing: false, paused: false, currentTime: 0 }))
    ctx.onTimeUpdate?.(() =>
      this.commit({
        currentTime: Number(ctx.currentTime ?? 0),
        duration: Number(ctx.duration ?? this.snap.duration),
      }),
    )
    ctx.onCanplay?.(() => this.commit({ duration: Number(ctx.duration ?? 0) }))
    ctx.onError?.(() => {
      warnOnce(
        'audio-play-error',
        'expo-audio 播放链:InnerAudioContext 报错 ⇒ 状态收回到未播放(不静默重试)',
      )
      this.commit({ playing: false, paused: false })
    })
    this.ctx = ctx
    return ctx
  }

  async play(): Promise<void> {
    if (!this.sourceUri) {
      warnOnce(
        'audio-play-no-url',
        'expo-audio 播放链:还没拿到音源就 play ⇒ 按无操作返回(不抛,调用方不 catch)',
      )
      return
    }
    this.ensure().play()
  }

  pause(): void {
    this.ctx?.pause()
  }

  stop(): void {
    this.ctx?.stop()
  }

  seekTo(seconds: number): void {
    const value = Math.max(0, Number(seconds) || 0)
    const duration = this.snap.duration
    if (duration > 0 && value > duration) {
      warnOnce('audio-seek-clamp', 'expo-audio 播放链:seek 超出时长 ⇒ 按末尾夹住')
    }
    this.ensure().seek(duration > 0 ? Math.min(value, duration) : value)
  }

  replace(sourceUri: string): void {
    if (!sourceUri) return
    this.sourceUri = sourceUri
    this.ensure().src = sourceUri
    this.commit({ currentTime: 0, duration: 0, playing: false, paused: false })
  }

  setVolume(volume: number): void {
    const value = Math.min(1, Math.max(0, Number(volume) || 0))
    if (this.ctx) this.ctx.volume = value
    this.commit({ volume: value })
  }

  /**
   * 小程序 InnerAudioContext **没有** muted 这一属性(现读 types/api/media/audio.d.ts 的接口体:
   * 只有 volume / obeyMuteSwitch)⇒ 静音由音量双向承载,并在第一次调用时点名,不假装有独立 mute 开关。
   */
  setMuted(muted: boolean): void {
    warnOnce(
      'audio-muted',
      'expo-audio 播放链:muted 在小程序无对应属性 ⇒ 由 volume(0 ⇄ 上一次音量)承载,听感等价但无系统级静音档',
    )
    if (muted) {
      if (this.snap.volume > 0) this.lastVolume = this.snap.volume
      if (this.ctx) this.ctx.volume = 0
      this.commit({ muted: true, volume: 0 })
    } else {
      const restore = this.lastVolume > 0 ? this.lastVolume : 1
      if (this.ctx) this.ctx.volume = restore
      this.commit({ muted: false, volume: restore })
    }
  }

  destroy(): void {
    this.ctx?.destroy()
    this.ctx = null
    this.listeners.clear()
  }
}

export function useAudioPlayer(source?: string | null): AudioPlayer {
  const holder = useRef<AudioPlayer | null>(null)
  if (holder.current === null) holder.current = new MiniAudioPlayer(source ?? null)
  const player = holder.current
  const uri = source ?? ''
  useEffect(() => {
    if (uri) player.replace(uri)
  }, [player, uri])
  useEffect(
    () => () => {
      player.destroy()
      holder.current = null
    },
    [player],
  )
  return player
}

export function useAudioPlayerStatus(player: AudioPlayer): AudioPlayerStatus {
  const subscribe = useMemo(() => player.subscribe.bind(player), [player])
  return useSyncExternalStore(
    subscribe,
    () => player.status,
    () => player.status,
  )
}

// ---------- 录音:RecorderManager(微信侧单例 ⇒ 事件只接一次再派发) ----------
// 单例归属只经 claimSlot() 这一模块级出口改(类内不写 `activeSlot = this`,既避 no-this-alias,
// 也让"谁接管了本轮"只有一个改动点，回调侧拿到的永远是同一张派发口)。

type RecorderSlot = {
  readonly owner: object
  mark: () => void
  finish: (tempFilePath: string, ok: boolean) => void
  stopRequested: () => void
  busy: () => boolean
}

let wiredManager: Taro.RecorderManager | null = null
let activeSlot: RecorderSlot | null = null

function claimSlot(next: RecorderSlot): void {
  if (activeSlot && activeSlot.owner !== next.owner && activeSlot.busy()) {
    warnOnce(
      'audio-record-singleton',
      'expo-audio 录音链:微信 RecorderManager 是单例 ⇒ 后起的 recorder 接管本轮,前一路会收到空 uri',
    )
    activeSlot.finish('', false)
  }
  activeSlot = next
}

function ensureManager(): Taro.RecorderManager {
  const manager = Taro.getRecorderManager()
  if (wiredManager === manager) return manager
  wiredManager = manager
  manager.onStop((res) => {
    activeSlot?.finish(String(res?.tempFilePath ?? ''), true)
  })
  manager.onStart(() => {
    activeSlot?.mark()
  })
  manager.onError(() => {
    warnOnce(
      'audio-record-error',
      'expo-audio 录音链:RecorderManager 报错 ⇒ 本轮未录到(返回空 uri,调用方按失败分支)',
    )
    activeSlot?.finish('', false)
  })
  manager.onInterruptionBegin?.(() => {
    warnOnce('audio-record-interrupt', 'expo-audio 录音链:被系统打断(来电等)⇒ 主动收尾本轮')
    activeSlot?.stopRequested()
  })
  return manager
}

class MiniAudioRecorder {
  uri = ''
  isRecording = false
  private pendingStop: Array<() => void> = []
  private readonly manager = ensureManager()
  private readonly startedAt = { at: 0 }
  /** 交给模块级派发口的那张接口(不暴露 this,单例只认这张口) */
  private readonly slot: RecorderSlot = {
    owner: {},
    mark: () => this.markRecording(),
    finish: (path, ok) => this.finish(path, ok),
    stopRequested: () => this.stopRequested(),
    busy: () => this.isRecording,
  }

  constructor(private readonly preset: unknown) {
    void this.preset
  }

  /** 派发口(仅供本文件的 manager 回调与 claimSlot 调用,不属于 expo-audio 公开面) */
  private markRecording(): void {
    this.isRecording = true
    this.startedAt.at = Date.now()
  }

  private finish(tempFilePath: string, ok: boolean): void {
    this.uri = ok && tempFilePath ? tempFilePath : ''
    this.isRecording = false
    this.flush()
  }

  private stopRequested(): void {
    if (this.isRecording) this.manager.stop()
  }

  private flush(): void {
    const waiting = this.pendingStop
    this.pendingStop = []
    for (const resolve of waiting) resolve()
  }

  async prepareToRecordAsync(): Promise<void> {
    const permission = await requestRecordingPermissionsAsync()
    if (!permission.granted) {
      warnOnce(
        'audio-record-perm',
        'expo-audio 录音链:未拿到 scope.record 授权 ⇒ prepareToRecordAsync 显式失败(调用方有 catch 分支)',
      )
      throw new Error('[rn-compat] 录音权限未授予')
    }
  }

  record(): void {
    // 单例接管只经 claimSlot(不在此写 activeSlot = this ⇒ 无 this 别名,改动点唯一)
    claimSlot(this.slot)
    this.uri = ''
    try {
      this.manager.start(START_OPTIONS)
      this.markRecording()
    } catch {
      warnOnce(
        'audio-record-start-fail',
        'expo-audio 录音链:start 抛错(多为未授权)⇒ 本轮记为未录到',
      )
      this.isRecording = false
    }
  }

  /** 微信在无录音时不回 onStop ⇒ 3s 兜底 resolve(uri 为空串),避免调用方 await 挂死 */
  stop(): Promise<void> {
    if (!this.isRecording) return Promise.resolve()
    this.manager.stop()
    return new Promise<void>((resolve) => {
      this.pendingStop.push(resolve)
      setTimeout(() => {
        if (this.isRecording) {
          warnOnce(
            'audio-record-stop-timeout',
            'expo-audio 录音链:onStop 未在 3s 内兑现 ⇒ 超时收口并丢弃本轮 uri',
          )
          this.finish('', false)
        }
        resolve()
      }, 3000)
    })
  }
}

export function useAudioRecorder(preset?: unknown): MiniAudioRecorder {
  const holder = useRef<MiniAudioRecorder | null>(null)
  if (holder.current === null) holder.current = new MiniAudioRecorder(preset)
  return holder.current
}

export default {
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioPlayer,
  useAudioPlayerStatus,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
