// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * VoiceCompanion — 语音栈的常驻宿主(2026-11-04 信息架构重构补洞)。
 *
 * 病根:第三轮把 VoiceToolbar 收进「+ → 更多工具」抽屉后,它只在菜单打开时挂载,
 * 于是三处全局能力被一起带走:
 *   1. Ctrl+Alt+V / B / H 的 window 事件监听(use-global-shortcuts 派发)没人接;
 *   2. <VoiceInput hidden> 随菜单关闭卸载 → 录音中途点页面任意处即中断/丢失;
 *   3. <VoiceSubtitleBar>(D62 播报字幕)只在抽屉打开时存在 → 正常播报时字幕消失。
 *
 * 拆法:VoiceCompanion 常驻输入区,独占引擎、快捷键、字幕条与状态;VoiceToolbar 退化为
 * 纯展示行(读本文件的 store、调本文件的 actions)。这样菜单开合只影响"入口可见性",
 * 不再影响语音生命周期。
 *
 * 实例隔离:store 以 voiceId(输入区的 React.useId)分桶 —— 侧栏浮窗 / 主聊天 / 工作台
 * 可能同时存在多个输入区,录音、状态点与快捷键必须各管各的,不能全局串台。
 */

import * as React from 'react'

import { VoiceInput, type VoiceInputHandle } from './voice-input'
import { VoiceSubtitleBar } from '@/components/ai/voice-subtitle-bar'
import { useChatStore } from '@/stores/chat'
import { readHandsFree, VOICE_HANDSFREE_KEY } from './voice-stream-speaker'
import type { MicErrorKind, SummaryView } from '@ihui/shared/chat/voice-subtitles'

const VOICE_PLAYBACK_KEY = 'ihui_voice_playback'
const VOICE_PLAYBACK_EVENT = 'ihui-voice-playback-changed'
const VOICE_HANDSFREE_EVENT = 'ihui-voice-handsfree-changed'

export interface VoiceCompanionState {
  recording: boolean
  micError: MicErrorKind | null
  playback: boolean
  handsFree: boolean
}

const INITIAL_STATE: VoiceCompanionState = {
  recording: false,
  micError: null,
  playback: false,
  handsFree: false,
}

interface VoiceStore {
  snapshot: VoiceCompanionState
  handle: VoiceInputHandle | null
  publish: (patch: Partial<VoiceCompanionState>) => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => VoiceCompanionState
  getServerSnapshot: () => VoiceCompanionState
}

const stores = new Map<string, VoiceStore>()

function createStore(): VoiceStore {
  let snapshot: VoiceCompanionState = INITIAL_STATE
  const listeners = new Set<() => void>()
  const publish = (patch: Partial<VoiceCompanionState>) => {
    let changed = false
    for (const key of Object.keys(patch) as Array<keyof VoiceCompanionState>) {
      if (patch[key] !== snapshot[key]) {
        changed = true
        break
      }
    }
    if (!changed) return
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }
  return {
    get snapshot() {
      return snapshot
    },
    handle: null,
    publish,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL_STATE,
  }
}

/** 按输入区实例取 store(不存在则建;空 id 兜底给单测/旧宿主) */
export function getVoiceStore(voiceId: string): VoiceStore {
  let store = stores.get(voiceId)
  if (!store) {
    store = createStore()
    stores.set(voiceId, store)
  }
  return store
}

/** VoiceToolbar 行只读订阅(录音态 / 播报态 / 连续对话态) */
export function useVoiceState(voiceId: string): VoiceCompanionState {
  const store = getVoiceStore(voiceId)
  return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

/** 主按钮 / 快捷键:开始/停止录音(引擎未挂载时安全 no-op) */
export function toggleVoiceRecording(voiceId: string): void {
  getVoiceStore(voiceId).handle?.toggleRecording()
}

/** 自动朗读开关(写入 localStorage + 广播,与 VoiceStreamSpeaker 同步) */
export function toggleVoicePlayback(voiceId: string): void {
  const store = getVoiceStore(voiceId)
  const next = !store.snapshot.playback
  if (!next) {
    // 关闭时让 VoiceStreamSpeaker 立即停掉正在播的音频(见 voice-stream-speaker.tsx)
    window.dispatchEvent(new CustomEvent(VOICE_PLAYBACK_EVENT))
  }
  window.localStorage.setItem(VOICE_PLAYBACK_KEY, next ? 'on' : 'off')
  window.dispatchEvent(new Event(VOICE_PLAYBACK_EVENT))
  store.publish({ playback: next })
}

/** 连续对话开关 */
export function toggleVoiceHandsFree(voiceId: string): void {
  const store = getVoiceStore(voiceId)
  const next = !store.snapshot.handsFree
  window.localStorage.setItem(VOICE_HANDSFREE_KEY, next ? 'on' : 'off')
  window.dispatchEvent(new Event(VOICE_HANDSFREE_EVENT))
  store.publish({ handsFree: next })
}

function readPlaybackEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(VOICE_PLAYBACK_KEY) === 'on'
}

/**
 * 播报(TTS)播放态的宿主侧只读观测。
 *
 * 不新建第二套播放栈、也不改 voice-stream-speaker.tsx:
 * HTMLMediaElement 的 play/playing/pause/ended/error 虽不冒泡,但捕获阶段必经 window。
 */
function useVoicePlayback(): { speaking: boolean; muted: boolean } {
  const [state, setState] = React.useState<{ speaking: boolean; muted: boolean }>({
    speaking: false,
    muted: false,
  })
  React.useEffect(() => {
    const live = new Set<HTMLAudioElement>()
    const sync = () => {
      setState((prev) => {
        const speaking = live.size > 0
        const muted = speaking && Array.from(live).every((el) => el.muted)
        return prev.speaking === speaking && prev.muted === muted ? prev : { speaking, muted }
      })
    }
    const onStart = (e: Event) => {
      if (e.target instanceof HTMLAudioElement) {
        live.add(e.target)
        sync()
      }
    }
    const onStop = (e: Event) => {
      if (e.target instanceof HTMLAudioElement) {
        live.delete(e.target)
        sync()
      }
    }
    const startEvents = ['play', 'playing'] as const
    const stopEvents = ['pause', 'ended', 'emptied', 'error'] as const
    for (const ev of startEvents) window.addEventListener(ev, onStart, true)
    for (const ev of stopEvents) window.addEventListener(ev, onStop, true)
    return () => {
      for (const ev of startEvents) window.removeEventListener(ev, onStart, true)
      for (const ev of stopEvents) window.removeEventListener(ev, onStop, true)
    }
  }, [])
  return state
}

export function VoiceCompanion({
  voiceId,
  onTranscript,
  disabled,
}: {
  voiceId: string
  onTranscript: (text: string) => void
  disabled?: boolean
}): React.JSX.Element {
  const voiceRef = React.useRef<VoiceInputHandle | null>(null)
  const [summaryView, setSummaryView] = React.useState<SummaryView>('discussionSummary')
  // 订阅自身发布的 store:字幕条要随录音态 / 麦克风错误态即时更新
  const { recording, micError } = useVoiceState(voiceId)

  const { speaking, muted } = useVoicePlayback()
  const subtitleText = useChatStore((s) => {
    const msgs = s.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (msg && msg.role === 'assistant') return msg.content ?? ''
    }
    return ''
  })

  // 常驻标记:记录当前活跃引擎,供 store actions(快捷键/行点击)打到同一实例
  React.useEffect(() => {
    const store = getVoiceStore(voiceId)
    const handle = voiceRef.current
    store.handle = handle
    return () => {
      if (store.handle === handle) store.handle = null
      stores.delete(voiceId)
    }
  }, [voiceId])

  // 拉取 VoiceInput 内部 recording/micError 到 store(RAF 轮询,避免 render 期读 ref)
  React.useEffect(() => {
    let raf = 0
    const tick = () => {
      const handle = voiceRef.current
      if (handle) {
        getVoiceStore(voiceId).publish({ recording: handle.recording, micError: handle.micError })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [voiceId])

  // 同步两个 toggle 的 localStorage 状态(跨组件事件 + storage 事件)
  React.useEffect(() => {
    const store = getVoiceStore(voiceId)
    const sync = () => {
      store.publish({ playback: readPlaybackEnabled(), handsFree: readHandsFree() })
    }
    sync()
    window.addEventListener(VOICE_PLAYBACK_EVENT, sync)
    window.addEventListener(VOICE_HANDSFREE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(VOICE_PLAYBACK_EVENT, sync)
      window.removeEventListener(VOICE_HANDSFREE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [voiceId])

  // 全局快捷键(use-global-shortcuts 派发事件,常驻宿主必须在场;按实例分桶)
  React.useEffect(() => {
    const onVoiceInput = () => toggleVoiceRecording(voiceId)
    const onVoicePlayback = () => toggleVoicePlayback(voiceId)
    const onVoiceHandsFree = () => toggleVoiceHandsFree(voiceId)
    window.addEventListener('global-shortcut:voice-input', onVoiceInput)
    window.addEventListener('global-shortcut:voice-playback', onVoicePlayback)
    window.addEventListener('global-shortcut:voice-handsfree', onVoiceHandsFree)
    return () => {
      window.removeEventListener('global-shortcut:voice-input', onVoiceInput)
      window.removeEventListener('global-shortcut:voice-playback', onVoicePlayback)
      window.removeEventListener('global-shortcut:voice-handsfree', onVoiceHandsFree)
    }
  }, [voiceId])

  return (
    <>
      {/* 内部 VoiceInput:只跑识别逻辑,不渲染按钮;通过 ref 桥接状态 */}
      <VoiceInput ref={voiceRef} onTranscript={onTranscript} disabled={disabled} hidden />
      {/* D62 装车点:字幕条常驻生产树 —— 播报中可见、四类麦克风错误逐类呈现、
          录音纪要 × 播报双激活时呈现互斥提示。 */}
      <VoiceSubtitleBar
        speaking={speaking}
        muted={muted}
        subtitle={subtitleText || undefined}
        micError={micError}
        summaryRecording={recording}
        view={summaryView}
        onViewChange={setSummaryView}
      />
    </>
  )
}

export default VoiceCompanion
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
