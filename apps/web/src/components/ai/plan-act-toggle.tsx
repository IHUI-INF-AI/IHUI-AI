'use client'

import * as React from 'react'

import { ListChecks, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'

export type PlanActMode = 'plan' | 'act'

/** Plan/Act 模式切换器(对标 Trae Work plan/act toggle + Codex)。
 *
 * 受控用法:`<PlanActToggle mode={m} onChange={setM} />`
 * 非受控(默认):读写 useChatStore.planMode,兼容 `<PlanActToggle />` 旧调用方。
 * - Plan:LLM 只制定计划不调用工具
 * - Act:正常 tool loop 执行(默认)
 *
 * 2026-07-25 v2 增强:用 ResizeObserver 测量自身渲染宽度,容器宽 < 60px 时
 * 折叠为单个 28px 图标按钮(避免被父容器 flex 布局压成 4px 不可见)。
 * 之前用 CSS container query 实测与 flex + min-w-0 + overflow-hidden 父容器
 * 冲突,父容器 size containment 反向把 inline-size 压成 4px,改用 JS 测量最稳。
 */
const COMPACT_THRESHOLD_PX = 60

function safeT(t: (key: string) => string, key: string, fallback: string): string {
  try {
    const v = t(key)
    // next-intl 缺失 key 时返回带 namespace 前缀的完整路径(如 "chat.modePlan"),
    // 因此除精确匹配外还需检查 namespace 后缀,确保 fallback 正确触发。
    return v === key || v.endsWith(`.${key}`) ? fallback : v
  } catch {
    return fallback
  }
}

export function PlanActToggle({
  mode,
  onChange,
  className,
}: {
  mode?: PlanActMode
  onChange?: (mode: PlanActMode) => void
  className?: string
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

  // 测量容器渲染宽度(2026-07-25 v2):useLayoutEffect 同步测量避免首帧渲染宽屏后
  // 再切窄屏的闪烁;ResizeObserver 监听父容器 resize 动态切换。
  // - compact=true:父容器可用空间 < 60px,渲染单个 28px 图标按钮
  // - compact=false:渲染 2 文字按钮(规划/执行,~ 60px 宽)
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [compact, setCompact] = React.useState(false)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      // 用 getBoundingClientRect 读真实渲染宽度(含 padding/border),
      // offsetWidth 同样可用但 getBoundingClientRect 更直观
      const w = el.getBoundingClientRect().width
      setCompact(w < COMPACT_THRESHOLD_PX)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      <span style={{ transform: 'translateY(0.7px)' }}>{label}</span>
    </button>
  )

  if (compact) {
    // 窄屏:单个 28px 图标按钮,点击切换 plan/act(2026-07-25 v2)
    const CurrentIcon = current === 'plan' ? ListChecks : Play
    const currentLabel = current === 'plan' ? planLabel : actLabel
    const currentTooltip = current === 'plan' ? planTooltip : actTooltip
    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Plan/Act mode"
        className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center', className)}
      >
        <button
          type="button"
          onClick={() => select(current === 'plan' ? 'act' : 'plan')}
          title={currentTooltip}
          aria-label={currentLabel}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150',
            'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
          )}
        >
          <CurrentIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // 宽屏:2 文字按钮(radiogroup 语义保留供 a11y)
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Plan/Act mode"
      className={cn(
        'inline-flex h-7 flex-shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5',
        className,
      )}
    >
      {wideBtn('plan', planLabel, planTooltip)}
      {wideBtn('act', actLabel, actTooltip)}
    </div>
  )
}
