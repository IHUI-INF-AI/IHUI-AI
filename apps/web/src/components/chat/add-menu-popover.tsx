// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ArrowRight, FileText, Loader2, Mic, Package, Plus, Scissors, Sparkles, Telescope } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import { Tooltip } from '@/components/feedback'
import { createPortal } from 'react-dom'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { SkillLibrary } from '@/components/chat/skill-library'
import { VoiceRecord } from '@/components/chat/voice-record'
import type { PromptTemplate } from '@/hooks/use-slash-action'

/** 层栈 id(见 @/lib/overlay-stack):menu / prompt / skill 三个子层共用同一入口身份 */
const ADD_MENU_OVERLAY_ID = 'add-menu-popover'

/**
 * "添加"下拉菜单 Popover(2026-07-25 终极整合,2026-07-30 提取自 message-input.tsx)
 *
 * 收纳 6 类动作,内部按 mode 切换 content:
 * - menu:6 项主菜单(模板 / 引用 / Skill 库 / 附件 / 插件 / 压缩上下文)
 * - prompt:PromptTemplates 弹层
 * - skill:SkillLibrary 弹层
 *
 * 避免嵌套弹层,trigger 始终是"添加"按钮,焦点 / 坐标 / ESC 行为统一。
 *
 * 行为零变更(与提取前 message-input.tsx 完全一致):
 * - 关闭时重置为 menu 态(下次打开从 menu 开始)
 * - "添加引用"在流式中或输入框为空时禁用
 * - "添加附件"在流式中禁用
 * - 所有动作执行后关闭 Popover + 重置 mode 为 menu(除 prompt / skill 子层切换外)
 */
export function AddMenuPopover(props: {
  open: boolean
  onOpenChange: (next: boolean) => void
  mode: 'menu' | 'prompt' | 'skill' | 'voice'
  onModeChange: (mode: 'menu' | 'prompt' | 'skill' | 'voice') => void
  isStreaming: boolean
  /** 当前输入框文本(用于"添加引用" disabled 判定) */
  inputValue: string
  promptTemplates: PromptTemplate[]
  /** PromptTemplates 选中回调(主组件负责 fillInput + 关闭 + 重置 mode) */
  onTemplateSelect: (content: string) => void
  /** SkillLibrary 选中回调(主组件负责 fillInput + 关闭 + 重置 mode) */
  onSkillSelect: (template: string) => void
  /** SkillLibrary 关闭回调(主组件负责关闭 + 重置 mode) */
  onSkillClose: () => void
  /** SkillLibrary 发送到聊天回调(将 AI Skill 结果内容发送到对话输入框) */
  onSkillSendToChat?: (content: string) => void
  /** "添加附件"回调(主组件负责关闭 + 重置 mode + 触发 file input click) */
  onAddFile: () => void
  /** 语音录制完成回调(2026-09-14 接线 VoiceRecord 孤儿组件,主组件负责 File 化 + addFileReference;
   *  停止录制即触发,弹层随后关闭) */
  onVoiceRecordComplete: (blob: Blob, duration: number) => void
  /** "添加引用"回调(主组件负责关闭 + 重置 mode + addTextReference + 清空 + resize) */
  onAddTextReference: () => void
  /** "插件市场"回调(主组件负责关闭 + 重置 mode + 跳转 /plugins) */
  onOpenPluginMarket: () => void
  /** "深度研究"回调(2026-09-07 工作线 B:主组件负责关闭 + 重置 mode + 跳转 /deep-research) */
  onOpenDeepResearch: () => void
  /** "压缩上下文"回调(2026-09-06 整合:剪刀按钮收纳进本菜单;主组件负责 POST /api/chat/compact)。
   *  返回 Promise 时菜单会等待其完成再关闭,以便请求期间在菜单内展示 loading 态。 */
  onCompactContext?: () => void | Promise<unknown>
  /** 压缩请求进行中(菜单项显示 loading 且禁用) */
  compacting?: boolean
  /** 无会话 ID 时禁用压缩入口 */
  compactDisabled?: boolean
}): React.JSX.Element {
  const t = useTranslations('chat')
  const tA11y = useTranslations('a11y')
  const tNav = useTranslations('nav')
  const {
    open,
    onOpenChange,
    mode,
    onModeChange,
    isStreaming,
    inputValue,
    promptTemplates,
    onTemplateSelect,
    onSkillSelect,
    onSkillClose,
    onSkillSendToChat,
    onAddFile,
    onVoiceRecordComplete,
    onAddTextReference,
    onOpenPluginMarket,
    onOpenDeepResearch,
    onCompactContext,
    compacting = false,
    compactDisabled = false,
  } = props

  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)

  const updateCoords = React.useCallback(() => {
    if (!triggerRef.current || !panelRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const panelRect = panelRef.current.getBoundingClientRect()
    const gap = 8
    const pad = 8
    const VW = window.innerWidth
    const VH = window.innerHeight

    let top = r.bottom + gap
    let left = r.left

    if (left + panelRect.width > VW - pad) {
      left = VW - pad - panelRect.width
    }
    left = Math.max(pad, left)

    if (top + panelRect.height > VH - pad) {
      top = r.top - gap - panelRect.height
    }
    top = Math.max(pad, top)

    setCoords({ top, left })
  }, [])

  React.useLayoutEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      updateCoords()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open, updateCoords])

  React.useEffect(() => {
    if (!open) return
    const throttledUpdate = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        updateCoords()
      })
    }

    window.addEventListener('scroll', throttledUpdate, { capture: true, passive: true })
    window.addEventListener('resize', throttledUpdate, { passive: true })

    const roTrigger =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
    if (roTrigger && triggerRef.current) roTrigger.observe(triggerRef.current)

    const roPanel = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
    if (roPanel && panelRef.current) roPanel.observe(panelRef.current)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
      roTrigger?.disconnect()
      roPanel?.disconnect()
    }
  }, [open, updateCoords])

  React.useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const triggerEl = triggerRef.current
      const contentEl = panelRef.current
      const target = event.target as Node
      if (triggerEl && triggerEl.contains(target)) return
      if (contentEl && contentEl.contains(target)) return
      onOpenChange(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open) return
    // 层栈:本菜单弹层的 Esc 只在栈顶时消费(与权限弹层 / Ctrl+/ 帮助面板等多层同开时,
    // 一次 Esc 不再把所有层一起关掉)
    pushOverlay(ADD_MENU_OVERLAY_ID)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isTopOverlay(ADD_MENU_OVERLAY_ID)) return
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      popOverlay(ADD_MENU_OVERLAY_ID)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open) {
      onModeChange('menu')
    }
  }, [open, onModeChange])

  return (
    <div className="flex min-w-0">
      <Tooltip content={t('addMenuLabel')}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={t('addMenuLabel')}
          aria-haspopup="menu"
          aria-expanded={open}
          data-testid="add-menu-trigger"
          // 2026-09-02 治理:自写 popover trigger 加 data-state,让 globals.css:1090
          // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制关闭后焦点环常驻。
          // 详见 scripts/check-popover-trigger-data-state.mjs。
          data-state={open ? 'open' : 'closed'}
          disabled={isStreaming}
          onClick={() => onOpenChange(!open)}
          className={cn(
            'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'hover:-translate-y-px',
          )}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{t('addMenuLabel')}</span>
        </button>
      </Tooltip>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            // z-popover(2026-09-14 补):portal 挂 body 且 z-auto,营销首页 hero 区
            // 祖先 z-10 会整体压住弹层 —— 菜单可见但所有点击被 H1 拦截(实测
            // prompt-templates/chat-manual-compact e2e 与真实用户同路径失败)。
            className="z-popover w-60 rounded-md border bg-popover text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={
              coords
                ? { position: 'fixed', top: coords.top, left: coords.left }
                : { position: 'fixed', top: -9999, left: -9999 }
            }
            role="menu"
            aria-label={t('addMenuDesc')}
            tabIndex={-1}
          >
            {mode === 'prompt' ? (
              <div className="w-72 p-1">
                <PromptTemplates
                  templates={promptTemplates}
                  onSelect={(content) => {
                    onTemplateSelect(content)
                  }}
                />
              </div>
            ) : mode === 'skill' ? (
              <SkillLibrary
                onSelect={(template) => {
                  onSkillSelect(template)
                }}
                onClose={() => {
                  onSkillClose()
                }}
                onSendToChat={onSkillSendToChat}
              />
            ) : mode === 'voice' ? (
              // 语音录制面板(2026-09-14 接线 VoiceRecord 孤儿组件,对标 Qoder Quest Voice):
              // 停止录制即回调 onVoiceRecordComplete(主组件 File 化入列附件)并关闭弹层
              <div className="w-60 p-3" data-testid="voice-record-panel">
                <VoiceRecord
                  onRecordComplete={(blob, duration) => {
                    onVoiceRecordComplete(blob, duration)
                    onOpenChange(false)
                    onModeChange('menu')
                  }}
                />
              </div>
            ) : (
              <div className="flex w-60 flex-col gap-0.5 p-1">
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onModeChange('prompt')
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('promptTemplate')}</span>
                  <ArrowRight className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/60" aria-hidden />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming || !inputValue.trim()}
                  onClick={() => {
                    if (!inputValue.trim()) return
                    onAddTextReference()
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('addContextReference')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onModeChange('skill')
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('skillLibrary.title')}</span>
                  <ArrowRight className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/60" aria-hidden />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onAddFile()
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{tA11y('addAttachment')}</span>
                </button>
                {/* 语音录制入口(2026-09-14 接线 VoiceRecord 孤儿组件):切换到 voice 子面板 */}
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onModeChange('voice')
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('voiceRecord.menuLabel')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onOpenPluginMarket()
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{tNav('pluginMarket')}</span>
                </button>
                {/* 深度研究入口(2026-09-07 工作线 B):跳转 /deep-research 页面发起多轮深挖研究 */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenDeepResearch()
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Telescope className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('deepResearchEntry')}</span>
                </button>
                {/* 压缩上下文(2026-09-06 整合):原工具栏独立剪刀按钮收纳进本菜单,
                    请求中显示 Loader2 且禁用;无会话(conversationId 为空)时禁用 */}
                {onCompactContext && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="compact-context-button"
                    aria-label={
                      compacting ? t('compaction.compacting') : t('compaction.compactButton')
                    }
                    disabled={isStreaming || compacting || compactDisabled}
                    onClick={async () => {
                      // 请求期间保持菜单打开以展示 loading 态,完成后再关闭
                      await onCompactContext()
                      onOpenChange(false)
                      onModeChange('menu')
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                      'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {compacting ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <Scissors className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {compacting ? t('compaction.compacting') : t('compaction.compactButton')}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
