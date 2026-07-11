/**
 * 音效服务（合并版）
 *
 * 合并自旧架构 services/soundService.ts。
 * 新架构基于纯 TypeScript + Web Audio API，无 Vue 依赖。
 * 兼容 SSR（typeof window 检查）。
 */

export type SoundType = 'step' | 'complete' | 'skip' | 'click' | 'success' | 'error'

interface SoundConfig {
  /** 频率（Hz），用于 Web Audio 合成 */
  frequency: number
  /** 持续时间（秒） */
  duration: number
  /** 音量 0-1 */
  volume: number
  /** 波形 */
  type?: OscillatorType
}

const sounds: Record<SoundType, SoundConfig> = {
  step: { frequency: 440, duration: 0.08, volume: 0.2, type: 'sine' },
  complete: { frequency: 880, duration: 0.25, volume: 0.35, type: 'sine' },
  skip: { frequency: 330, duration: 0.12, volume: 0.2, type: 'triangle' },
  click: { frequency: 600, duration: 0.04, volume: 0.15, type: 'square' },
  success: { frequency: 660, duration: 0.3, volume: 0.3, type: 'sine' },
  error: { frequency: 220, duration: 0.4, volume: 0.3, type: 'sawtooth' },
}

const SOUND_ENABLED_KEY = 'ihui:sound_enabled'

let audioCtx: AudioContext | null = null
let soundEnabled = true

/** 初始化（在客户端执行一次） */
function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioCtx) return audioCtx
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  audioCtx = new Ctor()
  return audioCtx
}

/** 从 localStorage 读取启用状态 */
function loadEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(SOUND_ENABLED_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

function saveEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SOUND_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // localStorage 不可用时静默忽略
  }
}

soundEnabled = loadEnabled()

/* ------------------------------------------------------------------ */
/* 核心 API                                                            */
/* ------------------------------------------------------------------ */

export function playSound(type: SoundType): void {
  if (!soundEnabled) return
  const ctx = ensureContext()
  if (!ctx) return
  // 浏览器策略：首次需在用户交互后恢复
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      // 恢复失败时静默忽略
    })
  }
  const config = sounds[type]
  if (!config) return

  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = config.type ?? 'sine'
    osc.frequency.value = config.frequency
    gain.gain.value = config.volume
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    osc.start(now)
    // 简单 ADSR：在 duration 内快速衰减
    gain.gain.setValueAtTime(config.volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration)
    osc.stop(now + config.duration)
  } catch {
    // 播放失败静默处理
  }
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
  saveEnabled(enabled)
}

export function isSoundEnabled(): boolean {
  return soundEnabled
}

export function toggleSound(): boolean {
  setSoundEnabled(!soundEnabled)
  return soundEnabled
}

/* ------------------------------------------------------------------ */
/* 预设动作（语义化）                                                  */
/* ------------------------------------------------------------------ */

export const soundService = {
  play: playSound,
  step: () => playSound('step'),
  complete: () => playSound('complete'),
  skip: () => playSound('skip'),
  click: () => playSound('click'),
  success: () => playSound('success'),
  error: () => playSound('error'),
  enable: () => setSoundEnabled(true),
  disable: () => setSoundEnabled(false),
  toggle: toggleSound,
  isEnabled: isSoundEnabled,
}

/** React Hook：在组件中使用音效 */
export function useSound(): typeof soundService {
  return soundService
}
