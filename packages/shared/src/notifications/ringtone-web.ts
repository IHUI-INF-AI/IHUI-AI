// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM WebAudio API

/**
 * Web/桌面铃声播放器(WebAudio 实时合成,SSR 安全)。
 *
 * 纯数据(音符表 / id 解析 / 本地存储 / Android 渠道映射)在 `./ringtone`;本模块只负责
 * 浏览器侧发声。RN 运行时 `global.window` 存在但没有 `AudioContext`,`getAudioContextCtor()`
 * 返回 null ⇒ 本模块函数静默返回 false,与拆出前行为一致,RN/小程序各自走原生音频。
 *
 * 行为口径(与拆出前一字不改):连发 1200ms 去抖、主音 + 2/3 次谐波三泛音合成、
 * autoplay 被拦截时静默失败(不抛错、不阻塞通知链路)。
 */

import { DEFAULT_RINGTONE_ID, getRingtone } from './ringtone'

// 本地最小 WebAudio 结构面:只声明本模块用到的成员,不引用 lib.dom 的 AudioContext 全局类型,
// 否则服务端 api tsc(无 DOM lib)会把本文件一并解析并对全局名报 TS2304/TS2552。
interface AudioParamLike {
  setValueAtTime(value: number, startTime: number): void
  exponentialRampToValueAtTime(value: number, endTime: number): void
}

interface AudioNodeLike {
  connect(node: unknown): void
  disconnect(): void
}

interface OscillatorNodeLike extends AudioNodeLike {
  type: string
  frequency: { value: number }
  start(when: number): void
  stop(when: number): void
  onended: (() => void) | null
}

interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike
}

interface WebAudioContextLike {
  state: 'suspended' | 'running' | 'closed'
  destination: unknown
  currentTime: number
  createOscillator(): OscillatorNodeLike
  createGain(): GainNodeLike
  resume(): Promise<void>
}

type AudioContextCtor = new () => WebAudioContextLike

interface AudioContextHost {
  AudioContext?: AudioContextCtor
  webkitAudioContext?: AudioContextCtor
}

/** 连发去抖:同一条通知链路短时间连炸时只响一次(微信同理,避免"叮叮叮"轰炸) */
const MIN_PLAY_INTERVAL_MS = 1200
let lastPlayedAt = 0
let sharedContext: WebAudioContextLike | null = null

function getAudioContextCtor(): AudioContextCtor | null {
  const g = globalThis as { window?: AudioContextHost } & AudioContextHost
  const host = g.window ?? g
  return host.AudioContext ?? host.webkitAudioContext ?? null
}

/** 复用一条音频上下文:每次新建会让浏览器累计挂起多个 context(移动端有数量上限) */
function ensureContext(): WebAudioContextLike | null {
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
