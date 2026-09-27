// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 语音朗读(P3 #46 阶段2,2026-09-17 立)。
 *
 * VoiceStreamSpeaker:挂 AI 面板根部,订阅 chat store;开关开启时,流式结束
 * (done 边沿)把最终 assistant 回复交给 /api/voice/tts(edge-tts,零 key)
 * 合成播放。不做流中碎句播报(edge-tts 逐段合成会产生句间硬切与重叠,体验
 * 差于整段播完;流中进度已由 #34 无障碍播报覆盖)。
 *
 * VoicePlaybackToggle:输入工具栏的开关按钮,写 localStorage
 * ihui_voice_playback(默认 off)并广播自定义事件,Speaker 监听同步。
 */

import * as React from 'react'
import { AudioLines, Volume2, VolumeX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { IconButton } from '@ihui/ui-react'
import { useChatStore } from '@/stores/chat'
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
    ? `${process.env.NEXT_PUBLIC_AI_SERVICE_URL}/voice/tts`
    : '/api/voice/tts'
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
  const isStreaming = useChatStore((s) => s.isStreaming)
  const accessToken = useWebAuthStore((s) => s.token)
  // 只订阅叶子值:最后一条 assistant 内容(字符串引用稳定)
  const content = useChatStore((s) => {
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

  const releaseObjectUrl = React.useCallback((): void => {
    if (objectUrlRef.current !== null) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  // 卸载/关闭开关时停止播放
  const stopPlayback = React.useCallback((): void => {
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

    let cancelled = false
    const speak = async (): Promise<void> => {
      // 本趟自己创建的 URL。handedOff 标记"句柄已交给 <audio>,释放权归
      // ended / error / stopPlayback";未交接成功前(含 new Audio 抛错)由下面的
      // finally 就地释放 —— 这就是"异常路径也成对"的那一半。
      let objectUrl: string | null = null
      let handedOff = false
      try {
        const res = await fetch(getTtsEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ text: speech, voice: 'zh-CN-XiaoxiaoNeural' }),
        })
        if (!res.ok || cancelled) return
        const blob = await res.blob()
        if (cancelled) return
        stopPlayback()
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) return
        const audio = new Audio(objectUrl)
        handedOff = true
        objectUrlRef.current = objectUrl
        audioRef.current = audio
        // 播完 / 解码失败即释放:此刻 src 已不再被读,继续留着就是纯泄漏
        const release = (): void => {
          if (objectUrlRef.current === objectUrl) releaseObjectUrl()
        }
        audio.addEventListener('ended', release)
        audio.addEventListener('error', release)
        await audio.play().catch(() => {
          /* 自动播放被浏览器策略拦截时静默放弃(用户未交互过的标签页) */
        })
        // play 期间组件被卸载:卸载那次 stopPlayback 早于本行,句柄会留在这里,补一次
        if (cancelled) stopPlayback()
      } catch {
        /* 朗读失败静默:辅助通道不干扰主流程 */
      } finally {
        if (!handedOff && objectUrl !== null) {
          URL.revokeObjectURL(objectUrl)
          if (objectUrlRef.current === objectUrl) objectUrlRef.current = null
        }
      }
    }
    void speak()
    return () => {
      cancelled = true
    }
    // content 在 done 边沿已是终值;仅以 isStreaming 变化驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  return null
}

export default VoiceStreamSpeaker
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
