// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FileText, Plus, Sparkles, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { createPortal } from 'react-dom'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { SkillLibrary } from '@/components/chat/skill-library'
import type { PromptTemplate } from '@/hooks/use-slash-action'

/**
 * "添加"下拉菜单 Popover(2026-07-25 终极整合,2026-07-30 提取自 message-input.tsx)
 *
 * 收纳 5 类动作,内部按 mode 切换 content:
 * - menu:5 项主菜单(模板 / 引用 / Skill 库 / 附件 / 插件)
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
  mode: 'menu' | 'prompt' | 'skill'
  onModeChange: (mode: 'menu' | 'prompt' | 'skill') => void
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
  /** "添加引用"回调(主组件负责关闭 + 重置 mode + addTextReference + 清空 + resize) */
  onAddTextReference: () => void
  /** "插件市场"回调(主组件负责关闭 + 重置 mode + 跳转 /plugins) */
  onOpenPluginMarket: () => void
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
    onAddTextReference,
    onOpenPluginMarket,
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

    const roTrigger = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open) {
      onModeChange('menu')
    }
  }, [open, onModeChange])

  return (
    <div>
      <Tooltip content={t('addMenuLabel')}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={t('addMenuLabel')}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={isStreaming}
          onClick={() => onOpenChange(!open)}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none whitespace-nowrap',
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
            className="w-60 rounded-md border bg-popover text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={
              coords
                ? { top: coords.top, left: coords.left }
                : { top: -9999, left: -9999 }
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
                  <span className="ml-auto text-[10px] text-muted-foreground/60">→</span>
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
                  <span className="ml-auto text-[10px] text-muted-foreground/60">→</span>
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
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
