// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  Check,
  ChevronUp,
  FileText,
  Hammer,
  ListTodo,
  Loader2,
  MessageCircleQuestion,
  Search,
  Wrench,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useModeStore } from '@/stores/mode'
import { useChatStore } from '@/stores/chat'
import {
  hydrateAgentProgressPaneFromStorage,
  useAgentProgressPaneStore,
} from '@/stores/agent-progress-pane'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import { useAiToolsPanelStore } from '@/stores/ai-tools-panel'
import type { ChatMode } from '@ihui/types'

/** ChatMode 5 态元信息(与 agent-progress-trigger.tsx CHAT_MODE_META 保持同形;
 *  单独声明 descKey 供菜单项描述使用) */
const CHAT_MODE_META: Record<
  ChatMode,
  { icon: React.ComponentType<{ className?: string }>; i18nKey: string; descKey: string }
> = {
  ask: { icon: MessageCircleQuestion, i18nKey: 'modeAsk', descKey: 'modeAskDesc' },
  build: { icon: Hammer, i18nKey: 'modeBuild', descKey: 'modeBuildDesc' },
  plan: { icon: BookOpen, i18nKey: 'modePlan', descKey: 'modePlanDesc' },
  review: { icon: Search, i18nKey: 'modeReview', descKey: 'modeReviewDesc' },
  spec: { icon: FileText, i18nKey: 'modeSpec', descKey: 'modeSpecDesc' },
}

/** 菜单展示顺序:build(默认)→ plan → ask → review → spec */
const CHAT_MODE_ORDER: ChatMode[] = ['build', 'plan', 'ask', 'review', 'spec']

/**
 * ModeSwitcher — 同会话模式选择器(2026-09-13 矩阵 A #24)
 *
 * 背景:4 模式按钮 2026-07-28 移除后,模式切换只剩斜杠命令(/ask /build /plan /review /spec)、
 * Ctrl+1-5 快捷键、AI 关键词自动判断三条"隐形"通道,输入区无任何可见控件,与对标程序
 * (Codex / Cursor / Qoder / Trae 均有显式模式选择器)存在 UX 断层。
 *
 * - 触发器:当前模式图标 + 名称(与左侧 / @ 按钮同尺寸风格)
 * - 菜单:顶部「任务进度」入口(切换右上角任务面板,Ctrl+Shift+J)+ 5 个模式单选项
 *   (icon + label + desc + 当前态 ✓),向上弹出(工具栏位于输入区底部)
 * - 数据流:读 useModeStore.currentMode,写 setMode(持久化 localStorage 'ihui-mode')
 * - 与三通道联动:任何通道切换后触发器即时反映(订阅 store 响应式更新)
 * - 流式中禁用(与 / @ 按钮 disabled={isStreaming} 一致,防中途状态困惑)
 *
 * 2026-09-14:原独立「构建任务」按钮(AgentProgressTrigger)并入本菜单统一管理,
 * 其实时状态、Pane store toggle、hydrate、Ctrl+Shift+J 快捷键逻辑迁移至此。
 */
export function ModeSwitcher({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations('chat')
  const tTools = useTranslations('aiToolsPanel')
  const currentMode = useModeStore((s) => s.currentMode)
  const setMode = useModeStore((s) => s.setMode)
  const current = CHAT_MODE_META[currentMode]
  const CurrentIcon = current.icon

  // 任务进度面板 store(原 AgentProgressTrigger 迁移)
  const togglePane = useAgentProgressPaneStore((s) => s.toggle)
  const paneOpen = useAgentProgressPaneStore((s) => s.open)
  const conversationId = useChatStore((s) => s.conversationId)
  const { planSteps, currentTask, isStreaming, overview } = useAgentProgress(conversationId)

  // AI 工具面板 store(原独立「工具面板」折叠按钮迁入菜单统一管理,2026-09-14)
  const toggleToolsPanel = useAiToolsPanelStore((s) => s.toggle)
  const toolsPanelOpen = useAiToolsPanelStore((s) => s.open)

  // 当前步骤(用于"构建 X/Y"格式显示)
  const totalSteps = planSteps.length
  const inProgressIdx = planSteps.findIndex((s) => s.status === 'in_progress')
  const currentStepNumber = inProgressIdx >= 0 ? inProgressIdx + 1 : overview.completedSteps

  // 实时状态文字优先级:流式任务名 → "模式 X/Y" → 模式名
  const liveStatusText = React.useMemo<string>(() => {
    const modeLabel = t(current.i18nKey)
    if (isStreaming && currentTask.label) return currentTask.label
    if (totalSteps > 0) {
      return `${modeLabel} ${String(currentStepNumber).padStart(2, '0')}/${String(totalSteps).padStart(2, '0')}`
    }
    return modeLabel
  }, [t, current, isStreaming, currentTask, totalSteps, currentStepNumber])

  // 客户端 mount 后同步 localStorage 中的 open/pinned
  React.useEffect(() => {
    hydrateAgentProgressPaneFromStorage()
  }, [])

  // Ctrl+Shift+J 全局快捷键:切换任务进度面板(帮助面板 shortcutTogglePane 明示)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        togglePane()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePane])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          data-testid="mode-switcher"
          data-mode={currentMode}
          aria-label={t('modeSwitcherLabel')}
          aria-haspopup="menu"
          className={cn(
            'flex h-8 min-w-0 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
            'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <CurrentIcon className="h-4 w-4 shrink-0" />
          {/* 2026-09-14:去掉 sm:inline — 窄 AI 面板(<280px 容器)下文字由容器查询决定,
              否则桌面端(视口≥640)强制显示文字导致工具栏溢出 */}
          <span className="hidden min-w-0 truncate @[280px]:inline">{t(current.i18nKey)}</span>
          <ChevronUp className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-64">
        {/* 任务进度入口(原独立「构建任务」按钮并入,2026-09-14) */}
        <DropdownMenuItem
          data-testid="menu-task-progress"
          data-pane-open={paneOpen}
          className="items-start gap-2 py-2"
          onSelect={() => togglePane()}
        >
          <ListTodo
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              isStreaming ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-medium leading-4">
              {t('taskProgressOpen')}
              {isStreaming && (
                <Loader2
                  className="h-3 w-3 shrink-0 animate-spin text-primary"
                  aria-hidden="true"
                  data-testid="agent-progress-live-spinner"
                />
              )}
            </div>
            <div className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
              {liveStatusText}
            </div>
          </div>
          <DropdownMenuShortcut>Ctrl+Shift+J</DropdownMenuShortcut>
        </DropdownMenuItem>
        {/* 工具面板入口(原独立「工具面板」折叠按钮并入,2026-09-14) */}
        <DropdownMenuItem
          data-testid="menu-tools-panel"
          data-panel-open={toolsPanelOpen}
          className="items-start gap-2 py-2"
          onSelect={() => toggleToolsPanel()}
        >
          <Wrench
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              toolsPanelOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium leading-4">{tTools('title')}</div>
            <div className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
              {toolsPanelOpen ? t('toolsPanelClose') : t('toolsPanelOpen')}
            </div>
          </div>
          {toolsPanelOpen && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {CHAT_MODE_ORDER.map((mode) => {
          const meta = CHAT_MODE_META[mode]
          const Icon = meta.icon
          const isSel = mode === currentMode
          return (
            <DropdownMenuItem
              key={mode}
              data-testid={`mode-option-${mode}`}
              aria-checked={isSel}
              role="menuitemradio"
              className={cn('items-start gap-2 py-2', isSel && 'bg-primary/5')}
              onSelect={() => {
                if (!isSel) setMode(mode)
              }}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  isSel ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium leading-4">{t(meta.i18nKey)}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {t(meta.descKey)}
                </div>
              </div>
              {isSel && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ModeSwitcher
