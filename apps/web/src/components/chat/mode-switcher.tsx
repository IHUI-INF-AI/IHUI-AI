// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTranslations } from 'next-intl'
import { Check, ChevronDown, Eye, FileText, Hammer, ClipboardList } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useModeStore } from '@/stores/mode'
import type { ChatMode } from '@ihui/types'
import { cn } from '@/lib/utils'

/**
 * 对话模式切换器(2026-09-13 矩阵 A #24):同会话模式切换的可见控件,
 * 与 / 命令、Ctrl+1-5、AI 自动判断三通道共用 useModeStore 单一状态源。
 *
 * 四态语义见 stores/mode.ts(build/plan/review/spec)。
 * 文案复用 chat.modeBuild/modePlan/modeReview/modeSpec 现有 i18n 键,不新增键。
 */

const MODE_ITEMS: Array<{
  mode: ChatMode
  labelKey: string
  descKey: string
  icon: typeof Hammer
}> = [
  { mode: 'build', labelKey: 'modeBuild', descKey: 'modeBuildDesc', icon: Hammer },
  { mode: 'plan', labelKey: 'modePlan', descKey: 'modePlanDesc', icon: ClipboardList },
  { mode: 'review', labelKey: 'modeReview', descKey: 'modeReviewDesc', icon: Eye },
  { mode: 'spec', labelKey: 'modeSpec', descKey: 'modeSpecDesc', icon: FileText },
]

export function ModeSwitcher({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations('chat')
  const currentMode = useModeStore((s) => s.currentMode)
  const setMode = useModeStore((s) => s.setMode)
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
            'flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
            'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <CurrentIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t(current.labelKey)}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
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
