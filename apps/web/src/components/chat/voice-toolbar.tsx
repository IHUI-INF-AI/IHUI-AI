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
import { COMPOSER_MENU_ROW_CLASS, COMPOSER_MENU_ROW_ICON_CLASS } from '@/lib/composer-menu-row'
import { Tooltip } from '@/components/feedback'
import {
  VoiceCompanion,
  toggleVoiceHandsFree,
  toggleVoicePlayback,
  toggleVoiceRecording,
  useVoiceState,
} from './voice-companion'

/**
 * VoiceToolbar — 语音入口行(2026-11-04 第三轮起收进「+ → 更多工具」抽屉)。
 *
 * 2026-11-04 拆档:引擎(<VoiceInput hidden>)、全局快捷键监听、播报字幕条(D62)已迁到
 * 常驻的 VoiceCompanion —— 菜单是条件挂载的浮层,不能承载有生命周期的语音栈,
 * 否则"录音中点页面即中断 / 播报字幕只在抽屉打开时可见 / Ctrl+Alt+V·B·H 失效"。
 * 本组件只剩入口与状态展示,状态从 voice-companion 的 store 读。
 *
 * variant:
 *   · row = + 菜单内的统一设置行(生产唯一用法);
 *   · bar = 底栏独立按钮形态,自带 Companion 宿主(单测/旧宿主用)。
 */

interface VoiceToolbarProps {
  /** 仅 bar 形态需要:转写文本回填;row 形态由 message-input 的常驻 Companion 提供 */
  onTranscript?: (text: string) => void
  disabled?: boolean
  /** row = + 菜单内的统一设置行(2026-11-04 第三轮) */
  variant?: 'bar' | 'row'
  /** 输入区实例 id:与常驻 Companion 分桶对齐(多输入区并存时不串台) */
  voiceId?: string
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

const noopTranscript = () => {}

export function VoiceToolbar(props: VoiceToolbarProps) {
  const { onTranscript, disabled, variant = 'bar', voiceId } = props
  const t = useTranslations('chat')
  const [menuOpen, setMenuOpen] = React.useState(false)
  const fallbackVoiceId = React.useId()
  const instanceId = voiceId ?? fallbackVoiceId
  // 引擎与状态都在常驻 VoiceCompanion,这里只读(菜单开合不再影响录音/快捷键/字幕)
  const { recording, playback, handsFree } = useVoiceState(instanceId)

  const handleMainClick = () => {
    if (disabled) return
    toggleVoiceRecording(instanceId)
  }

  // 主按钮视觉:录音中红底 + 波形;空闲按状态点显示绿/蓝小徽章
  const showStatusDot = !recording && !disabled && (playback || handsFree)
  const statusDotClassName =
    playback && handsFree ? 'bg-primary' : playback ? 'bg-emerald-500' : 'bg-sky-500'

  return (
    <>
      {variant === 'bar' && (
        <VoiceCompanion
          voiceId={instanceId}
          onTranscript={onTranscript ?? noopTranscript}
          disabled={disabled}
        />
      )}
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
              data-variant={variant}
              className={cn(
                variant === 'row'
                  ? COMPOSER_MENU_ROW_CLASS
                  : cn(
                      'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-sm transition-colors',
                      recording
                        ? 'bg-red-500 text-white hover:bg-red-500/90'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    ),
                variant === 'row' && recording && 'text-destructive',
              )}
            >
              {variant === 'row' ? (
                <>
                  {recording ? (
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center gap-0.5">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={`row-bar-${i}`}
                          className="w-0.5 rounded bg-destructive"
                          style={{
                            height: '100%',
                            transformOrigin: 'center',
                            animation: `voice-wave 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                          }}
                        />
                      ))}
                    </span>
                  ) : (
                    <Mic className={COMPOSER_MENU_ROW_ICON_CLASS} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{t('voiceInputStart')}</span>
                  {(recording || showStatusDot) && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        recording ? 'bg-red-500' : statusDotClassName,
                      )}
                    />
                  )}
                  <span className="max-w-[52%] truncate text-label text-muted-foreground">
                    {recording ? t('voiceInputStop') : ''}
                  </span>
                </>
              ) : (
                <>
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
                </>
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
              onSelect={() => toggleVoiceRecording(instanceId)}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
              onSelect={() => toggleVoicePlayback(instanceId)}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
              onSelect={() => toggleVoiceHandsFree(instanceId)}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
      </DropdownMenu.Root>
    </>
  )
}

export default VoiceToolbar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
