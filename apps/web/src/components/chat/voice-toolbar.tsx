// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * VoiceToolbar — 语音三合一按钮(2026-09-18 用户规则:"这几个按钮能不能整合成一个按钮功能啊")。
 *
 * 合并三个原独立按钮:
 *   1. 语音输入(VoiceInput) — 麦克风:录音 / 转写
 *   2. 语音朗读(VoicePlaybackToggle) — 流式结束自动 TTS
 *   3. 连续对话(VoiceHandsFreeToggle) — 转写段落直接自动发送
 *
 * 交互:
 *   · 主按钮(Mic):空闲单击触发录音,录音中变红+波形并显示停止提示;流式中禁用
 *   · 主按钮右上角状态点:绿点=自动朗读 on,蓝点=连续对话 on,两者同时开用主色合并
 *   · 主按钮下拉(Radix DropdownMenu modal={false} 允许点开后再点主按钮切录音):
 *     - 语音输入 — 主按钮同款 toggle(录音状态)
 *     - 语音朗读 — 写入 localStorage + 广播事件(与 VoiceStreamSpeaker 同步)
 *     - 连续对话 — 写入 localStorage + 广播事件(与 message-input 消费同步)
 *
 * 内部持有 <VoiceInput hidden ref> 只走识别逻辑,不渲染其默认按钮;
 * 通过 VoiceInputHandle 桥接 recording/pending/toggle 状态。
 */

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Mic, AudioLines, Volume2, VolumeX } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { VoiceInput, type VoiceInputHandle } from './voice-input'
import { readHandsFree, VOICE_HANDSFREE_KEY } from './voice-stream-speaker'
// D62(G-76,2026-09-25 装车):字幕条渲染位的真实宿主。此前 VoiceSubtitleBar 只有
// 自身测试消费、生产零渲染 ⇒ "播报时字幕可见 / 静音并显示字幕" 语义为空。
// 本组件把两个既有栈的状态映射进纯展示组件:
//   · summaryRecording ← VoiceInputHandle.recording(下方 RAF 轮询已有链路);
//   · micError        ← VoiceInputHandle.micError(voice-input 内 classifyMicError 归一);
//   · speaking/muted  ← useVoicePlayback() 对播报音频的只读观测(不改 VoiceStreamSpeaker);
//   · subtitle        ← chat store 最后一条 assistant 内容(与 Speaker 同一取数形状)。
import { VoiceSubtitleBar } from '@/components/ai/voice-subtitle-bar'
import { useChatStore } from '@/stores/chat'
import type { MicErrorKind, SummaryView } from '@ihui/shared/chat/voice-subtitles'

/**
 * 播报(TTS)播放态的宿主侧只读观测。
 *
 * 不新建第二套播放栈、也不改 voice-stream-speaker.tsx(本票文件清单外):
 * HTMLMediaElement 的 play/playing/pause/ended/error 虽不冒泡,但**捕获阶段必经
 * window**,故在 window 上以 capture=true 监听即可拿到"当前有音频在播"的真值;
 * muted 取在播元素全体 muted(=「静音并显示字幕」态的实机来源)。
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

const VOICE_PLAYBACK_KEY = 'ihui_voice_playback'
const VOICE_PLAYBACK_EVENT = 'ihui-voice-playback-changed'

function readPlaybackEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(VOICE_PLAYBACK_KEY) === 'on'
}

function writePlaybackEnabled(next: boolean): void {
  window.localStorage.setItem(VOICE_PLAYBACK_KEY, next ? 'on' : 'off')
  window.dispatchEvent(new Event(VOICE_PLAYBACK_EVENT))
}

function writeHandsFree(next: boolean): void {
  window.localStorage.setItem(VOICE_HANDSFREE_KEY, next ? 'on' : 'off')
  window.dispatchEvent(new Event('ihui-voice-handsfree-changed'))
}

interface VoiceToolbarProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

/**
 * 快捷键提示徽标(2026-09-18 用户规则:"请为这些快捷键添加快捷键提示显示"):
 * 与 kbd 元素同风格,在按钮 Tooltip / dropdown item 行尾显示,
 * 让用户不必打开快捷键帮助面板(Ctrl+/)也能看到三项语音快捷键。
 */
function ShortcutHint({ keys }: { keys: string }) {
  return (
    <kbd
      aria-hidden="true"
      className="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground"
    >
      {keys}
    </kbd>
  )
}

/** 键盘组合在 tooltip 中的分隔:用中间点避免与 " + " 混淆 */
function tooltipWithShortcut(label: string, key: string): React.ReactNode {
  return (
    <span className="flex items-center gap-2">
      <span>{label}</span>
      <ShortcutHint keys={key} />
    </span>
  )
}

export function VoiceToolbar({ onTranscript, disabled }: VoiceToolbarProps) {
  const t = useTranslations('chat')
  const voiceRef = React.useRef<VoiceInputHandle | null>(null)
  const [recording, setRecording] = React.useState(false)
  const [micError, setMicError] = React.useState<MicErrorKind | null>(null)
  const [playback, setPlayback] = React.useState(false)
  const [handsFree, setHandsFree] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [summaryView, setSummaryView] = React.useState<SummaryView>('discussionSummary')

  // D62:播报态(字幕可见性来源)与字幕正文(与 VoiceStreamSpeaker 同一取数形状)
  const { speaking, muted } = useVoicePlayback()
  const subtitleText = useChatStore((s) => {
    const msgs = s.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (msg && msg.role === 'assistant') return msg.content ?? ''
    }
    return ''
  })

  // 拉取 VoiceInput 内部 recording 状态:handleRef 镜像最新值,
  // 这里用 RAF 轮询同步到本地 state,避免在 render 中读 ref(React 18 strict mode 会告警)
  React.useEffect(() => {
    let raf = 0
    let last = false
    let lastMicError: MicErrorKind | null = null
    const tick = () => {
      const handle = voiceRef.current
      if (handle && handle.recording !== last) {
        last = handle.recording
        setRecording(last)
      }
      // D62:classifyMicError 归一后的四类错误同样经 handle 轮询上桥到字幕条
      if (handle && handle.micError !== lastMicError) {
        lastMicError = handle.micError
        setMicError(lastMicError)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 同步两个 toggle 的 localStorage 状态(跨组件 storage 事件 + 内部事件广播)
  React.useEffect(() => {
    const sync = () => {
      setPlayback(readPlaybackEnabled())
      setHandsFree(readHandsFree())
    }
    sync()
    window.addEventListener(VOICE_PLAYBACK_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(VOICE_PLAYBACK_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleMainClick = () => {
    if (disabled) return
    voiceRef.current?.toggleRecording()
  }

  const togglePlayback = () => {
    const next = !readPlaybackEnabled()
    if (!next) {
      // 关闭时让 VoiceStreamSpeaker 立即停掉正在播的音频(见 voice-stream-speaker.tsx)
      window.dispatchEvent(new CustomEvent(VOICE_PLAYBACK_EVENT))
    }
    writePlaybackEnabled(next)
  }

  const toggleHandsFree = () => {
    writeHandsFree(!readHandsFree())
  }

  // 快捷键(2026-09-18 用户规则:"请为这些组件添加快捷键支持"):
  //   Ctrl+Alt+V → 录音开始/停止(等价主按钮单击)
  //   Ctrl+Alt+B → 自动朗读开关
  //   Ctrl+Alt+H → 连续对话开关
  // 由 use-global-shortcuts 派发 event,disabled 期间(VoiceInput 未挂载或流式中)由本组件自行忽略。
  const handleMainClickRef = React.useRef(handleMainClick)
  const togglePlaybackRef = React.useRef(togglePlayback)
  const toggleHandsFreeRef = React.useRef(toggleHandsFree)
  handleMainClickRef.current = handleMainClick
  togglePlaybackRef.current = togglePlayback
  toggleHandsFreeRef.current = toggleHandsFree

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onVoiceInput = () => handleMainClickRef.current()
    const onVoicePlayback = () => togglePlaybackRef.current()
    const onVoiceHandsFree = () => toggleHandsFreeRef.current()
    window.addEventListener('global-shortcut:voice-input', onVoiceInput)
    window.addEventListener('global-shortcut:voice-playback', onVoicePlayback)
    window.addEventListener('global-shortcut:voice-handsfree', onVoiceHandsFree)
    return () => {
      window.removeEventListener('global-shortcut:voice-input', onVoiceInput)
      window.removeEventListener('global-shortcut:voice-playback', onVoicePlayback)
      window.removeEventListener('global-shortcut:voice-handsfree', onVoiceHandsFree)
    }
  }, [])

  // 主按钮视觉:录音中红底 + 波形;空闲按状态点显示绿/蓝小徽章
  const showStatusDot = !recording && !disabled && (playback || handsFree)
  const statusDotClassName =
    playback && handsFree ? 'bg-primary' : playback ? 'bg-emerald-500' : 'bg-sky-500'

  return (
    <DropdownMenu.Root modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenu.Trigger asChild>
        <Tooltip
          content={tooltipWithShortcut(
            recording ? t('voiceInputStop') : t('voiceInputStart'),
            'Ctrl+Alt+V',
          )}
          side="top"
        >
          <button
            type="button"
            onClick={handleMainClick}
            disabled={disabled}
            aria-label={recording ? t('voiceInputStop') : t('voiceInputStart')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-testid="voice-toolbar-main"
            className={cn(
              'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
              recording
                ? 'bg-red-500 text-white hover:bg-red-500/90'
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
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {showStatusDot && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-card',
                  statusDotClassName,
                )}
              />
            )}
          </button>
        </Tooltip>
      </DropdownMenu.Trigger>
      <style>{`
        @keyframes voice-wave {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1); }
        }
      `}</style>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-popover w-56 rounded-lg border bg-card p-1 text-card-foreground shadow-md"
        >
          {/* 语音输入:主按钮同款 toggle;用普通 Item + 右侧状态指示方点,与 model-selector 风格一致 */}
          <DropdownMenu.Item
            onSelect={() => {
              voiceRef.current?.toggleRecording()
            }}
            className={cn(
              'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
              'focus:bg-accent focus:text-accent-foreground',
            )}
          >
            {recording ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-red-500 text-white">
                <span className="block h-1.5 w-1.5 rounded-sm bg-white" />
              </span>
            ) : (
              <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 truncate font-medium">
              {recording ? t('voiceInputStop') : t('voiceInputStart')}
            </span>
            <ShortcutHint keys="Ctrl+Alt+V" />
            <span
              aria-hidden="true"
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-sm',
                recording ? 'bg-red-500' : 'bg-border',
              )}
            />
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
          <DropdownMenu.Item
            onSelect={() => togglePlayback()}
            className={cn(
              'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
              'focus:bg-accent focus:text-accent-foreground',
            )}
          >
            {playback ? (
              <Volume2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 truncate font-medium">{t('voicePlayback')}</span>
            <ShortcutHint keys="Ctrl+Alt+B" />
            <span
              aria-hidden="true"
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-sm',
                playback ? 'bg-emerald-500' : 'bg-border',
              )}
            />
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
          <DropdownMenu.Item
            onSelect={() => toggleHandsFree()}
            className={cn(
              'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
              'focus:bg-accent focus:text-accent-foreground',
            )}
          >
            <AudioLines
              className={cn(
                'h-4 w-4 shrink-0',
                handsFree ? 'text-sky-500' : 'text-muted-foreground',
              )}
            />
            <span className="flex-1 truncate font-medium">{t('voiceHandsFree')}</span>
            <ShortcutHint keys="Ctrl+Alt+H" />
            <span
              aria-hidden="true"
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-sm',
                handsFree ? 'bg-sky-500' : 'bg-border',
              )}
            />
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
      {/* 内部 VoiceInput:hidden 只跑识别逻辑,不渲染按钮;通过 ref 桥接 recording/pending/toggle */}
      <VoiceInput ref={voiceRef} onTranscript={onTranscript} disabled={disabled} hidden />
      {/* D62 装车点:字幕条在生产渲染树内 —— 播报中可见(静音仍可见)、四类麦克风
          错误逐类呈现、录音纪要 × 播报双激活时呈现互斥提示(判定全在共享层)。 */}
      <VoiceSubtitleBar
        speaking={speaking}
        muted={muted}
        subtitle={subtitleText || undefined}
        micError={micError}
        summaryRecording={recording}
        view={summaryView}
        onViewChange={setSummaryView}
      />
    </DropdownMenu.Root>
  )
}

export default VoiceToolbar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
