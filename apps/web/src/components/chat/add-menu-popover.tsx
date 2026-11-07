// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  ArrowRight,
  FileText,
  Loader2,
  Mic,
  Package,
  Plus,
  Scissors,
  Sparkles,
  Telescope,
  Wrench,
} from 'lucide-react'
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
  mode: 'menu' | 'prompt' | 'skill' | 'voice' | 'tools'
  onModeChange: (mode: 'menu' | 'prompt' | 'skill' | 'voice' | 'tools') => void
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
  /** 追加菜单项(2026-09-30 底栏单行化):宿主(message-input)以 ReactNode 传入
   *  多源建议 / 一键润色等从底栏降级下来的入口,渲染在"深度研究"之后、"压缩上下文"之前。
   *  由宿主传入而非本组件内部 import,避免 message-input ↔ add-menu-popover 循环依赖。 */
  extraMenuItems?: React.ReactNode
  /** 「更多工具」抽屉(2026-11-04 信息架构重构):宿主把底栏降级的次要控件
   *  (任务进度 / 权限 / 模式 / Agent / 上下文环 / 语音 / 流式 Steer 等)以 ReactNode 传入,
   *  在 + 菜单内成组展示。仍由宿主 import 与持有状态,本组件只负责"分组 + 返回"，
   *  不复制任何动作逻辑。 */
  toolsMenuItems?: React.ReactNode
  /** 「快捷设置」第一层(2026-11-04 第二轮收敛):权限 / 模式 / Agent 三项高频切换
   *  直接渲染在 + 菜单第一层,宿主点击 + 后再点一次即可展开各自面板(≤2 击)。
   *  低频项仍留在 toolsMenuItems 的「更多工具」子层。 */
  primaryMenuItems?: React.ReactNode
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
    extraMenuItems,
    toolsMenuItems,
    primaryMenuItems,
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
      // 2026-11-04 第二轮收敛:第一层快捷设置里嵌的是 Radix DropdownMenu / PortalPanel,
      // 它们的面板 portal 到 body,位于本面板 DOM 之外。若这里照旧关闭,+ 菜单会在
      // mousedown 时卸载 → 嵌套 Root 随之卸载 → 后续 click 永远到不了菜单项。
      if (target instanceof Element && target.closest('[data-radix-popper-content-wrapper]')) return
      // PortalPanel 无 Radix 包装层,用其 dialog 语义识别(权限面板)。
      if (target instanceof Element && target.closest('[data-composer-nested-panel]')) return
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
          /* 2026-11-04 信息架构重构:触发器不再因流式而整体禁用 ——
             流式专属动作(Steer / 打断并发送)现在住在「更多工具」抽屉里,
             整钮禁用会让这些动作在流式期间彻底不可达。菜单项各自保留 disabled 判据。 */
          onClick={() => onOpenChange(!open)}
          className={cn(
            // 第三轮(2026-11-04):底栏只保留 [+ / 模型 / 发送],+ 收敛为纯图标 32px,
            // 与同排图标按钮同规格;菜单语义由 aria-label / Tooltip 承载。
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm px-0 leading-none',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'hover:-translate-y-px',
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
        </button>
      </Tooltip>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            // z-popover(2026-09-14 补):portal 挂 body 且 z-auto,营销首页 hero 区
            // 祖先 z-10 会整体压住弹层 —— 菜单可见但所有点击被 H1 拦截(实测
            // prompt-templates/chat-manual-compact e2e 与真实用户同路径失败)。
            className="pointer-events-auto z-[2200] max-h-[calc(100vh-1rem)] w-60 overflow-y-auto overscroll-contain rounded-md border bg-popover text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            ) : mode === 'tools' && toolsMenuItems ? (
              /* 更多工具抽屉(2026-11-04):返回菜单 + 宿主注入的控件组。
                 控件仍在宿主(message-input)里 import 与持有状态,这里只做分组容器。 */
              <div className="w-60 p-1" data-testid="composer-tools-panel">
                <button
                  type="button"
                  role="menuitem"
                  data-testid="composer-tools-back"
                  onClick={() => {
                    onModeChange('menu')
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 rotate-180 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{t('backToMenu')}</span>
                </button>
                <div className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-1">
                  {toolsMenuItems}
                </div>
              </div>
            ) : (
              <div className="flex w-60 flex-col gap-0.5 p-1">
                {/* 快捷设置第一层(2026-11-04 第二轮收敛):权限 / 模式 / Agent 三项
                    高频切换不再藏在「更多工具」子层,点 + 后再点一次即可打开各自面板。 */}
                {primaryMenuItems && (
                  <div
                    role="group"
                    aria-label={t('quickSettings')}
                    data-testid="composer-quick-settings"
                    className="mb-1 border-b border-border/60 pb-1"
                  >
                    <span className="block px-1.5 pb-0.5 pt-0.5 text-[11px] font-medium text-muted-foreground">
                      {t('quickSettings')}
                    </span>
                    {/* 第三轮(2026-11-04):第一层不再把三枚控件并排成「迷你工具栏」,
                        改为纵向统一设置行(图标 + 标签 + 当前值 + 箭头),行高 32px */}
                    <div className="flex flex-col gap-0.5">{primaryMenuItems}</div>
                  </div>
                )}
                <span className="mt-1 block px-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground">
                  {t('composerSectionContent')}
                </span>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onModeChange('prompt')
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('promptTemplate')}</span>
                  <ArrowRight
                    className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/60"
                    aria-hidden
                  />
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
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
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
                    onAddFile()
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
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
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('voiceRecord.menuLabel')}</span>
                </button>
                <span className="mt-1 block px-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground">
                  {t('composerSectionCapability')}
                </span>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onModeChange('skill')
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('skillLibrary.title')}</span>
                  <ArrowRight
                    className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/60"
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isStreaming}
                  onClick={() => {
                    onOpenPluginMarket()
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
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
                  disabled={isStreaming}
                  onClick={() => {
                    onOpenDeepResearch()
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
                    'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Telescope className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t('deepResearchEntry')}</span>
                </button>
                {/* 底栏降级入口(2026-09-30 底栏单行化):多源建议 / 一键润色等
                    从输入框底栏收纳进本菜单,由宿主以 extraMenuItems 传入 */}
                {extraMenuItems}
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
                      'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
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
                <div className="my-1 border-t border-border/60" aria-hidden />
                {/* 更多工具入口(2026-11-04 信息架构重构):底栏降级的次要控件
                    (任务进度 / 上下文环 / 语音输入 / 语音笔记 / 流式 Steer)收纳于此,
                    点击进入 tools 子层;不改变任何控件自身的弹层与状态机。 */}
                {toolsMenuItems && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="composer-tools-entry"
                    onClick={() => {
                      onModeChange('tools')
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-label transition-colors',
                      'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{t('moreTools')}</span>
                    <ArrowRight
                      className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/60"
                      aria-hidden
                    />
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
