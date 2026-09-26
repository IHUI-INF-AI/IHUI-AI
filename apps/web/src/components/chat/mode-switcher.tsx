// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTranslations } from 'next-intl'
import { Check, ChevronDown, Eye, FileText, Hammer, ClipboardList, Wrench, MessageCircleQuestion } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useModeStore } from '@/stores/mode'
import { useAiToolsPanelStore } from '@/stores/ai-tools-panel'
import type { ChatMode } from '@ihui/types'
import { cn } from '@/lib/utils'

/**
 * 对话模式切换器(2026-09-13 矩阵 A #24):同会话模式切换的可见控件,
 * 与 / 命令、Ctrl+1-5、AI 自动判断三通道共用 useModeStore 单一状态源。
 *
 * 五态语义见 stores/mode.ts(ask/build/plan/review/spec)。
 * 文案复用 chat.modeBuild/modePlan/modeReview/modeSpec/modeAsk 现有 i18n 键,不新增键。
 * V3 #53(2026-09-26)补 ask 态:此前 Ctrl+5 能切但 UI 不可见(切换器只列 4 态)。
 *
 * 2026-09-14 合并收口:额外保留「工具面板」入口(menu-tools-panel),见下方注释。
 */

const MODE_ITEMS: Array<{
  mode: ChatMode
  labelKey: string
  descKey: string
  icon: typeof Hammer
}> = [
  { mode: 'ask', labelKey: 'modeAsk', descKey: 'modeAskDesc', icon: MessageCircleQuestion },
  { mode: 'build', labelKey: 'modeBuild', descKey: 'modeBuildDesc', icon: Hammer },
  { mode: 'plan', labelKey: 'modePlan', descKey: 'modePlanDesc', icon: ClipboardList },
  { mode: 'review', labelKey: 'modeReview', descKey: 'modeReviewDesc', icon: Eye },
  { mode: 'spec', labelKey: 'modeSpec', descKey: 'modeSpecDesc', icon: FileText },
]

export function ModeSwitcher({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations('chat')
  const tTools = useTranslations('aiToolsPanel')
  const currentMode = useModeStore((s) => s.currentMode)
  const setMode = useModeStore((s) => s.setMode)
  const toolsPanelOpen = useAiToolsPanelStore((s) => s.open)
  const toggleToolsPanel = useAiToolsPanelStore((s) => s.toggle)
  const current = MODE_ITEMS.find((m) => m.mode === currentMode) ?? MODE_ITEMS[0]
  if (!current) return null
  const CurrentIcon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t(current.labelKey)}
          className={cn(
            'mode-switcher-trigger flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
            'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <CurrentIcon className="h-4 w-4" />
          {/* mode-switcher-text:窄容器由 globals.css @container 隐藏(sm: 是视口断点,
              管不住 300px AI 面板;视口宽面板窄时文字会把底部 toolbar 挤到右组溢出重叠) */}
          <span className="mode-switcher-text hidden sm:inline">{t(current.labelKey)}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* 工具面板入口(2026-09-14 合并收口):AiSidePanelTools 的唯一开关。
            ai-side-panel.tsx 挂载的 <AiSidePanelTools />(承载 Plan/Memory/Checkpoints/
            Best-of/Hooks/RepoWiki 等 W21–W29 面板)依赖本入口,缺失则永远无法打开。 */}
        <DropdownMenuItem
          data-testid="menu-tools-panel"
          data-panel-open={toolsPanelOpen}
          onSelect={() => toggleToolsPanel()}
          className={cn('gap-2', toolsPanelOpen && 'bg-accent')}
        >
          <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium leading-tight">{tTools('title')}</span>
            <span className="truncate text-xs text-muted-foreground leading-tight">
              {toolsPanelOpen ? t('toolsPanelClose') : t('toolsPanelOpen')}
            </span>
          </span>
          {toolsPanelOpen && <Check className="ml-auto h-4 w-4 shrink-0" />}
        </DropdownMenuItem>
        {MODE_ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.mode === currentMode
          return (
            <DropdownMenuItem
              key={item.mode}
              onSelect={() => setMode(item.mode)}
              className={cn('gap-2', active && 'bg-accent')}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium leading-tight">{t(item.labelKey)}</span>
                <span className="truncate text-xs text-muted-foreground leading-tight">
                  {t(item.descKey)}
                </span>
              </span>
              {active && <Check className="ml-auto h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
