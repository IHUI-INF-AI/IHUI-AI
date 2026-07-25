'use client'

import * as React from 'react'

import { ListChecks, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'

export type PlanActMode = 'plan' | 'act'
export type PlanActVariant = 'icon' | 'text' | 'auto'

/** Plan/Act 模式切换器(对标 Trae Work plan/act toggle + Codex)。
 *
 * 受控用法:`<PlanActToggle mode={m} onChange={setM} variant="icon" />`
 * 非受控(默认):读写 useChatStore.planMode,兼容 `<PlanActToggle />` 旧调用方。
 * - Plan:LLM 只制定计划不调用工具
 * - Act:正常 tool loop 执行(默认)
 *
 * variant 决定渲染形态(2026-07-25 v3 简化):
 * - icon:始终渲染单个 32px 图标按钮,占位最省(AI 面板 header 强制使用,
 *   header 已有 4 个图标按钮 + 厂商图标 + 标题,空间不足再放 2 文字按钮)
 * - text:始终渲染 2 文字按钮(规划/执行),适合有专门模式栏的场景
 * - auto:用 ResizeObserver 测量容器宽度,≥ 90px 渲染 2 文字,否则渲染 1 图标
 *   (之前用 60px 阈值实测过窄,因父容器 flex 给的 60px 仍会切掉"规划"2 汉字
 *   一半,文字按钮最低需要 90px 才能稳定显示"规划/执行"4 字符)
 *
 * v3 删除内容(2026-07-25):删除 v2 的 `style={{ transform: 'translateY(0.7px)' }}`
 * 硬编码垂直对齐 hack — 违反 AGENTS.md §4 "严禁 -mt-px / margin-top: -1px 反向微调
 * hack"硬规则,改用 globals.css 中 text-xs(12px)专用 0.7px 全局规则自动应用。
 */
const AUTO_TEXT_THRESHOLD_PX = 90

function safeT(t: (key: string) => string, key: string, fallback: string): string {
  try {
    const v = t(key)
    return v === key || v.endsWith(`.${key}`) ? fallback : v
  } catch {
    return fallback
  }
}

export function PlanActToggle({
  mode,
  onChange,
  className,
  variant = 'auto',
}: {
  mode?: PlanActMode
  onChange?: (mode: PlanActMode) => void
  className?: string
  /**
   * 渲染形态(2026-07-25 v3):
   * - icon:始终 32px 单图标(AI 面板 header 用,极简)
   * - text:始终 2 文字按钮(规划/执行,适合模式栏)
   * - auto:根据可用宽度自动切换(默认,自适应当前容器)
   */
  variant?: PlanActVariant
}) {
  const storeMode = useChatStore((s) => s.planMode)
  const setStoreMode = useChatStore((s) => s.setPlanMode)
  const current = mode ?? storeMode
  const t = useTranslations('chat')
  const planLabel = safeT(t, 'modePlan', '规划')
  const actLabel = safeT(t, 'modeAct', '执行')
  const planTooltip = safeT(
    t,
    'planTooltip',
    'Plan:AI 只制定计划,不执行工具(Alt+P 切换 / 输入 /plan)',
  )
  const actTooltip = safeT(
    t,
    'actTooltip',
    'Act:AI 正常执行工具(Alt+P 切换 / 输入 /act)',
  )

  const select = (m: PlanActMode) => {
    if (onChange) onChange(m)
    if (mode === undefined) setStoreMode(m)
  }

  // 测量容器渲染宽度(auto 模式):useLayoutEffect 同步测量避免首帧渲染闪烁;
  // ResizeObserver 监听父容器 resize 动态切换。
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [compact, setCompact] = React.useState(false)
  React.useLayoutEffect(() => {
    if (variant !== 'auto') return
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      setCompact(w < AUTO_TEXT_THRESHOLD_PX)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [variant])

  // text 模式 或 auto 且不 compact:渲染 2 文字按钮
  if (variant === 'text' || (variant === 'auto' && !compact)) {
    const wideBtn = (m: PlanActMode, label: string, title: string) => (
      <button
        type="button"
        role="radio"
        aria-checked={current === m}
        onClick={() => select(m)}
        title={title}
        className={cn(
          'inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium leading-none transition-all duration-150',
          current === m
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {label}
      </button>
    )

    return (
      <div
        ref={variant === 'auto' ? ref : null}
        role="radiogroup"
        aria-label="Plan/Act mode"
        className={cn(
          'inline-flex h-8 flex-shrink-0 items-center gap-0.5 rounded-md bg-muted/60 p-0.5',
          className,
        )}
      >
        {wideBtn('plan', planLabel, planTooltip)}
        {wideBtn('act', actLabel, actTooltip)}
      </div>
    )
  }

  // icon 模式 或 auto 且 compact:渲染单个图标按钮(与 header 其他按钮高度一致 h-8)
  // 当前 mode 的图标 + tooltip,点击切换
  const CurrentIcon = current === 'plan' ? ListChecks : Play
  const currentLabel = current === 'plan' ? planLabel : actLabel
  const currentTooltip = current === 'plan' ? planTooltip : actTooltip
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Plan/Act mode"
      className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center', className)}
    >
      <button
        type="button"
        onClick={() => select(current === 'plan' ? 'act' : 'plan')}
        title={currentTooltip}
        aria-label={currentLabel}
        // 视觉(2026-07-25 v3 精修):
        // - 高度 h-8 w-8 跟 AI 面板 header 其他按钮(新对话/Subagent/关闭)统一
        // - 圆角 rounded-md 跟其他按钮统一
        // - 当前 mode 用 bg-primary text-primary-foreground 实色高亮(明确指示),
        //   inactive 用 bg-muted text-muted-foreground(跟其他 header 按钮一致)
        // - hover transition 150ms 跟全局节奏统一
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150',
          current === 'plan'
            ? 'bg-primary text-primary-foreground shadow-sm hover:opacity-90'
            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <CurrentIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
