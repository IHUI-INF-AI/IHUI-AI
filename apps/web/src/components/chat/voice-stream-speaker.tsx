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
      title={enabled ? t('voicePlaybackOn') : t('voicePlaybackOff')}
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
      title={enabled ? t('voiceHandsFreeOn') : t('voiceHandsFreeOff')}
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

  // 卸载/关闭开关时停止播放
  const stopPlayback = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }, [])

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
    const speak = async () => {
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
        const audio = new Audio(URL.createObjectURL(blob))
        audioRef.current = audio
        await audio.play().catch(() => {
          /* 自动播放被浏览器策略拦截时静默放弃(用户未交互过的标签页) */
        })
      } catch {
        /* 朗读失败静默:辅助通道不干扰主流程 */
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
