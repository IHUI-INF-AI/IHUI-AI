// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知铃声单一真相源(2026-11-26 立)。
 *
 * 设计取舍:
 * - 铃声是一组「音符序列」(freq/start/dur/gain),不是外部 mp3。所有端都从本文件的
 *   同一张表取值:web 用 AudioContext 实时合成,RN/小程序播放由
 *   `scripts/gen-ringtone-assets.mjs` 从同一张表渲染出的 WAV(生成脚本 import 本文件,
 *   采样率/包络/泛音全部同源),三端听感不会漂。
 * - 不使用任何第三方成品音源:微信/QQ/苹果/诺基亚的提示音都是有版权的音效,
 *   直接内置 = 侵权。这里全部是自制合成音,只在「品类」上贴近大众熟悉的听感
 *   (门铃、水滴、气泡、木琴…),没有任何一段采样来自其他产品。
 * - 模块本身零 import、SSR 安全:任何拿到 window 的调用才碰 WebAudio。
 */

export type RingtoneId =
  | 'dingdong'
  | 'tritone'
  | 'waterdrop'
  | 'doublebell'
  | 'bubble'
  | 'marimba'
  | 'chime'
  | 'knock'

/** 单个音符:start/dur 单位秒,freq 单位 Hz,gain 为相对音量(0-1) */
export interface RingtoneNote {
  freq: number
  start: number
  dur: number
  gain?: number
}

export interface RingtoneSpec {
  id: RingtoneId
  /** 该序列总时长(秒),供资产渲染与试听进度判断 */
  duration: number
  notes: RingtoneNote[]
}

/**
 * 8 个铃声。名字与序列刻意做成大众熟悉的品类:
 * 门铃「叮—咚」、上扬三音、水滴、双响清脆铃、气泡三连、木琴、和弦铃、轻敲两下。
 * 改动任何 freq/dur 都会同时改变三端听感 —— 必须先跑 gen-ringtone-assets 重出资产。
 */
export const RINGTONES: readonly RingtoneSpec[] = [
  {
    id: 'dingdong',
    duration: 0.95,
    notes: [
      { freq: 659.25, start: 0, dur: 0.3, gain: 0.72 },
      { freq: 523.25, start: 0.34, dur: 0.55, gain: 0.58 },
    ],
  },
  {
    id: 'tritone',
    duration: 0.66,
    notes: [
      { freq: 440, start: 0, dur: 0.13, gain: 0.6 },
      { freq: 493.88, start: 0.15, dur: 0.13, gain: 0.62 },
      { freq: 587.33, start: 0.3, dur: 0.32, gain: 0.55 },
    ],
  },
  {
    id: 'waterdrop',
    duration: 0.3,
    notes: [
      { freq: 1500, start: 0, dur: 0.07, gain: 0.45 },
      { freq: 900, start: 0.07, dur: 0.2, gain: 0.4 },
    ],
  },
  {
    id: 'doublebell',
    duration: 0.5,
    notes: [
      { freq: 1046.5, start: 0, dur: 0.1, gain: 0.55 },
      { freq: 1046.5, start: 0.15, dur: 0.1, gain: 0.5 },
      { freq: 1318.5, start: 0.3, dur: 0.19, gain: 0.45 },
    ],
  },
  {
    id: 'bubble',
    duration: 0.32,
    notes: [
      { freq: 700, start: 0, dur: 0.07, gain: 0.5 },
      { freq: 900, start: 0.09, dur: 0.07, gain: 0.52 },
      { freq: 1150, start: 0.18, dur: 0.1, gain: 0.48 },
    ],
  },
  {
    id: 'marimba',
    duration: 0.5,
    notes: [
      { freq: 523.25, start: 0, dur: 0.13, gain: 0.6 },
      { freq: 783.99, start: 0.17, dur: 0.3, gain: 0.5 },
    ],
  },
  {
    id: 'chime',
    duration: 0.6,
    notes: [
      { freq: 880, start: 0, dur: 0.5, gain: 0.4 },
      { freq: 1174.66, start: 0.02, dur: 0.45, gain: 0.28 },
      { freq: 1318.51, start: 0.04, dur: 0.42, gain: 0.24 },
    ],
  },
  {
    id: 'knock',
    duration: 0.34,
    notes: [
      { freq: 180, start: 0, dur: 0.07, gain: 0.5 },
      { freq: 180, start: 0.13, dur: 0.07, gain: 0.45 },
    ],
  },
] as const

export const DEFAULT_RINGTONE_ID: RingtoneId = 'dingdong'

export const RINGTONE_IDS: readonly RingtoneId[] = RINGTONES.map((r) => r.id)

const RINGTONE_ID_SET = new Set<string>(RINGTONE_IDS)

/** 把任意存储值收敛成合法铃声 id;未知/空值一律回落默认,绝不留下"选了但播不出来"的状态 */
export function resolveRingtoneId(raw: unknown): RingtoneId {
  return typeof raw === 'string' && RINGTONE_ID_SET.has(raw)
    ? (raw as RingtoneId)
    : DEFAULT_RINGTONE_ID
}

export function getRingtone(id: unknown): RingtoneSpec {
  const resolved = resolveRingtoneId(id)
  return RINGTONES.find((r) => r.id === resolved) ?? RINGTONES[0]!
}

/* -------------------------------------------------------------------------- */
/* 本地存储:铃声选择在设备本地先落一份,后端 user_preferences 是跨端同步真相源  */
/* -------------------------------------------------------------------------- */

const RINGTONE_STORAGE_KEY = 'ihui-notification-ringtone'

export function readStoredRingtoneId(): RingtoneId {
  if (typeof window === 'undefined') return DEFAULT_RINGTONE_ID
  try {
    return resolveRingtoneId(window.localStorage.getItem(RINGTONE_STORAGE_KEY))
  } catch {
    return DEFAULT_RINGTONE_ID
  }
}

export function writeStoredRingtoneId(id: RingtoneId): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RINGTONE_STORAGE_KEY, resolveRingtoneId(id))
  } catch {
    // 隐私模式/配额满:静默,后端仍会存
  }
}

/* -------------------------------------------------------------------------- */
/* Web/桌面播放器:WebAudio 实时合成(SSR 安全)                                  */
/* -------------------------------------------------------------------------- */

type AudioContextCtor = typeof AudioContext
interface WindowWithAudioContext {
  AudioContext?: AudioContextCtor
  webkitAudioContext?: AudioContextCtor
}

/** 连发去抖:同一条通知链路短时间连炸时只响一次(微信同理,避免"叮叮叮"轰炸) */
const MIN_PLAY_INTERVAL_MS = 1200
let lastPlayedAt = 0
let sharedContext: AudioContext | null = null

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as WindowWithAudioContext
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** 复用一条 AudioContext:每次新建会让浏览器累计挂起多个 context(移动端有数量上限) */
function ensureContext(): AudioContext | null {
  if (sharedContext && sharedContext.state !== 'closed') return sharedContext
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null
  try {
    sharedContext = new Ctor()
    return sharedContext
  } catch {
    return null
  }
}

/** 首次交互解锁(浏览器自动播放策略);已解锁时是空操作 */
export function unlockRingtoneAudio(): void {
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
}

/**
 * 播放指定铃声。SSR / 未解锁 / 被自动播放策略拦截时静默(不抛错、不阻塞通知链路)。
 * @returns 是否真的发起了播放(被去抖拦下返回 false)
 */
export function playRingtone(id: unknown = DEFAULT_RINGTONE_ID, volume = 1): boolean {
  const now = Date.now()
  if (now - lastPlayedAt < MIN_PLAY_INTERVAL_MS) return false
  const ctx = ensureContext()
  if (!ctx) return false
  if (ctx.state === 'suspended') {
    // 未解锁时尝试恢复;真被拦下就静默,等下一次用户交互后的解锁
    void ctx.resume().catch(() => {})
  }
  const spec = getRingtone(id)
  const t0 = ctx.currentTime + 0.02
  try {
    for (const note of spec.notes) {
      // 主音 + 两个泛音:纯正弦听起来像"电子蜂鸣",叠 2/3 次谐波才像真实铃/木琴
      const partials: Array<[number, number]> = [
        [1, 1],
        [2, 0.32],
        [3, 0.16],
      ]
      for (const [multiple, weight] of partials) {
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = note.freq * multiple
        const peak = (note.gain ?? 0.5) * weight * volume
        const start = t0 + note.start
        const end = start + note.dur
        gainNode.gain.setValueAtTime(0.0001, start)
        gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.006)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, end)
        osc.connect(gainNode)
        gainNode.connect(ctx.destination)
        osc.start(start)
        osc.stop(end + 0.01)
        osc.onended = () => {
          osc.disconnect()
          gainNode.disconnect()
        }
      }
    }
    lastPlayedAt = now
    return true
  } catch {
    return false
  }
}

/**
 * 试听:用户在设置页主动点「试听」必须立刻出声,不能被上面的 1200ms 去抖拦下
 * —— 否则连点几个铃声只有第一个响得出来,后面全被吃掉。
 * 试听后照常记录播放时刻,避免试听刚结束就收到通知又叠响一次。
 */
export function previewRingtone(id: unknown = DEFAULT_RINGTONE_ID, volume = 1): boolean {
  lastPlayedAt = 0
  return playRingtone(id, volume)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
