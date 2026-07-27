'use client'

import * as React from 'react'
import { Hammer, BookOpen, Search, FileText, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import type { ChatMode } from '@ihui/types'
import { useModeStore } from '@/stores/mode'
import { Tooltip } from '@/components/feedback'
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
 * 紧凑风格(AGENTS.md §4,对标 Trae IDE segmented control):h-6 px-2 text-xs rounded,连体容器 bg-muted/50。
 * 选中态 bg-background text-foreground shadow-sm(subtle 凸出,非 primary 满色),未选中透明底 hover:bg-background/60。
 *
 * 模式建议(2026-07-25 立,对标 CLI mode-manager.ts 的 suggestMode):
 * - 监听 document 'input' 事件,过滤 textarea(消息输入框)
 * - 关键词匹配:分析/调研→plan,审查/检查→review,规格/规范/契约→spec,修改/实现→build
 * - 仅当建议模式 ≠ 当前模式时,在按钮组右侧显示一个 subtle 建议气泡
 * - 点击气泡切换模式;hover 显示推荐理由;不强制自动切换,尊重用户选择
 */

interface ModeOption {
  mode: ChatMode
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** toast.success 用,只含模式描述(避免 toast 文案过长) */
  toastText: string
  /** button title 属性(tooltip)用,含快捷键 + / 命令提示,补全三通道可发现性(2026-07-28 立) */
  tooltipText: string
}

/** suggestMode 用的硬编码中文标签(reason 文案保持硬编码中文,不在 i18n 范围) */
const MODE_LABEL_FALLBACK: Record<ChatMode, string> = {
  build: '构建',
  plan: '计划',
  review: '审查',
  spec: '规格',
}

/** 关键词 → 模式映射(对齐 CLI SUGGEST_KEYWORDS,扩展 spec) */
const SUGGEST_KEYWORDS: { mode: ChatMode; keywords: string[] }[] = [
  { mode: 'plan', keywords: ['调研', '分析', '了解', '看看', '查看', '研究', '探索', '梳理', 'plan'] },
  { mode: 'build', keywords: ['修改', '实现', '重构', '添加', '删除', '编写', '创建', '修复', '更新', 'build'] },
  { mode: 'review', keywords: ['审查', '检查', '对比', '评审', 'review', 'diff'] },
  { mode: 'spec', keywords: ['规格', '规范', '契约', 'spec', 'specification'] },
]

interface ModeSuggestion {
  mode: ChatMode
  reason: string
}

/** 根据用户输入文本推荐模式(关键词匹配,首次命中优先) */
function suggestMode(userInput: string): ModeSuggestion | null {
  if (!userInput.trim()) return null
  const text = userInput.toLowerCase()
  for (const { mode, keywords } of SUGGEST_KEYWORDS) {
    const hit = keywords.find((kw) => text.includes(kw.toLowerCase()))
    if (hit) {
      const label = MODE_LABEL_FALLBACK[mode] ?? mode
      return { mode, reason: `命中关键词"${hit}",建议切换到${label}模式` }
    }
  }
  return null
}

/** safeT:i18n key 不存在或未解析时回退到 fallback(对齐 plan-act-toggle.tsx 模式) */
function safeT(t: (key: string) => string, key: string, fallback: string): string {
  try {
    const v = t(key)
    return v === key || v.endsWith(`.${key}`) ? fallback : v
  } catch {
    return fallback
  }
}

export function ModeSwitcher({ className }: { className?: string }) {
  const currentMode = useModeStore((s) => s.currentMode)
  const setMode = useModeStore((s) => s.setMode)
  const [suggestion, setSuggestion] = React.useState<ModeSuggestion | null>(null)
  const t = useTranslations('chat')

  const MODE_OPTIONS: readonly ModeOption[] = React.useMemo(
    () => [
      {
        mode: 'build',
        label: safeT(t, 'modeBuild', '构建'),
        icon: Hammer,
        toastText: safeT(t, 'modeBuildToast', '已切换到构建模式'),
        tooltipText: safeT(t, 'modeBuildTooltip', '构建模式 · Ctrl+1 或 /build'),
      },
      {
        mode: 'plan',
        label: safeT(t, 'modePlan', '计划'),
        icon: BookOpen,
        toastText: safeT(t, 'modePlanToast', '已切换到计划模式(只读分析)'),
        tooltipText: safeT(t, 'modePlanTooltip', '计划模式(只读分析) · Ctrl+2 或 /plan'),
      },
      {
        mode: 'review',
        label: safeT(t, 'modeReview', '审查'),
        icon: Search,
        toastText: safeT(t, 'modeReviewToast', '已切换到审查模式(只读审查)'),
        tooltipText: safeT(t, 'modeReviewTooltip', '审查模式(只读审查) · Ctrl+3 或 /review'),
      },
      {
        mode: 'spec',
        label: safeT(t, 'modeSpec', '规格'),
        icon: FileText,
        toastText: safeT(t, 'modeSpecToast', '已切换到规格模式(生成 spec 文档)'),
        tooltipText: safeT(t, 'modeSpecTooltip', '规格模式(生成 spec 文档) · Ctrl+4 或 /spec'),
      },
    ],
    [t],
  )

  const MODE_LABEL: Record<ChatMode, string> = React.useMemo(
    () => ({
      build: safeT(t, 'modeBuild', '构建'),
      plan: safeT(t, 'modePlan', '计划'),
      review: safeT(t, 'modeReview', '审查'),
      spec: safeT(t, 'modeSpec', '规格'),
    }),
    [t],
  )

  const handleSelect = React.useCallback(
    (option: ModeOption) => {
      if (option.mode === currentMode) return
      setMode(option.mode)
      toast.success(option.toastText)
    },
    [currentMode, setMode],
  )

  // 监听消息输入框 textarea 变化,实时计算模式建议
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const onInput = (e: Event) => {
      const target = e.target
      if (!(target instanceof HTMLTextAreaElement)) return
      setSuggestion(suggestMode(target.value))
    }
    document.addEventListener('input', onInput)
    return () => document.removeEventListener('input', onInput)
  }, [])

  const acceptSuggestion = React.useCallback(() => {
    if (!suggestion || suggestion.mode === currentMode) return
    const option = MODE_OPTIONS.find((o) => o.mode === suggestion.mode)
    if (!option) return
    setMode(option.mode)
    toast.success(option.toastText)
    setSuggestion(null)
  }, [suggestion, currentMode, setMode, MODE_OPTIONS])

  const showSuggestion = suggestion !== null && suggestion.mode !== currentMode

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div
        role="group"
        aria-label="对话模式切换"
        className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5"
      >
        {MODE_OPTIONS.map((option) => {
          const isActive = option.mode === currentMode
          const Icon = option.icon
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => handleSelect(option)}
              aria-pressed={isActive}
              title={option.tooltipText}
              className={cn(
                'flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
      {showSuggestion && suggestion !== null && (
        <Tooltip content={suggestion.reason} side="bottom">
          <button
            type="button"
            onClick={acceptSuggestion}
            aria-label={`切换到${MODE_LABEL[suggestion.mode]}模式`}
            className={cn(
              'flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
              'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Sparkles className="h-3 w-3" />
            <span>切换到{MODE_LABEL[suggestion.mode]}</span>
          </button>
        </Tooltip>
      )}
    </div>
  )
}
