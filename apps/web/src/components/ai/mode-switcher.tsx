'use client'

import * as React from 'react'
import { Hammer, BookOpen, Search, FileText } from 'lucide-react'
import { toast } from 'sonner'
import type { ChatMode } from '@ihui/types'
import { useModeStore } from '@/stores/mode'
import { cn } from '@/lib/utils'

/**
 * 模式切换器(2026-07-22 立,对标 Trae IDE Plan/Spec 双模式)。
 *
 * 四态横排按钮组(对齐 CLI apps/cli/src/tui/mode-manager.ts,扩展 spec):
 * - 构建(build):  正常执行,全工具开放
 * - 计划(plan):   只读分析,deny write 工具
 * - 审查(review): 只读审查,deny write 工具 + 强化审查 prompt
 * - 规格(spec):   从代码反向生成 spec 文档
 *
 * 紧凑风格(AGENTS.md §4):h-7 px-2 text-xs rounded,ButtonGroup 风格(border 分隔,非 divide-x)。
 * 选中态 bg-primary text-primary-foreground,未选中 bg-muted text-muted-foreground。
 */

interface ModeOption {
  mode: ChatMode
  label: string
  icon: React.ComponentType<{ className?: string }>
  toastText: string
}

const MODE_OPTIONS: readonly ModeOption[] = [
  { mode: 'build', label: '构建', icon: Hammer, toastText: '已切换到构建模式' },
  { mode: 'plan', label: '计划', icon: BookOpen, toastText: '已切换到计划模式(只读分析)' },
  { mode: 'review', label: '审查', icon: Search, toastText: '已切换到审查模式(只读审查)' },
  { mode: 'spec', label: '规格', icon: FileText, toastText: '已切换到规格模式(生成 spec 文档)' },
]

// TODO(suggestMode):用户输入"分析/审查/检查"自动建议 plan/review,"规格/规范/契约"建议 spec。
// 参考 CLI apps/cli/src/tui/mode-manager.ts 的 suggestMode 关键词匹配逻辑。
// 当前不强制实现,后续可在 message-input 输入变化时调 suggestMode(userInput) 显示建议气泡。

export function ModeSwitcher({ className }: { className?: string }) {
  const currentMode = useModeStore((s) => s.currentMode)
  const setMode = useModeStore((s) => s.setMode)

  const handleSelect = React.useCallback(
    (option: ModeOption) => {
      if (option.mode === currentMode) return
      setMode(option.mode)
      toast.success(option.toastText)
    },
    [currentMode, setMode],
  )

  return (
    <div
      role="group"
      aria-label="对话模式切换"
      className={cn('flex items-center border border-border rounded-md overflow-hidden', className)}
    >
      {MODE_OPTIONS.map((option, idx) => {
        const isActive = option.mode === currentMode
        const Icon = option.icon
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => handleSelect(option)}
            aria-pressed={isActive}
            title={option.toastText}
            className={cn(
              'flex h-7 items-center gap-1 px-2 text-xs font-medium transition-colors',
              // ButtonGroup border 分隔(非 divide-x):每个按钮 border-r,末尾无
              idx < MODE_OPTIONS.length - 1 && 'border-r border-border',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
