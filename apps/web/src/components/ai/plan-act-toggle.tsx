'use client'

import * as React from 'react'

import { ListChecks, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'

import './plan-act-toggle.css'

export type PlanActMode = 'plan' | 'act'

/** Plan/Act 模式切换器(对标 Trae Work plan/act toggle + Codex)。
 *
 * 受控用法:`<PlanActToggle mode={m} onChange={setM} />`
 * 非受控(默认):读写 useChatStore.planMode,兼容 `<PlanActToggle />` 旧调用方。
 * - Plan:LLM 只制定计划不调用工具
 * - Act:正常 tool loop 执行(默认)
 *
 * 2026-07-25 增强:容器 < 360px 时折叠为单个图标按钮(ListChecks/Play),
 * 避免在窄屏 ai-side-panel 挤占其他 toolbar 元素(详见 plan-act-toggle.css)。
 */
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

  const btn = (m: PlanActMode, label: string, title: string) => (
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

  // 窄屏折叠态(2026-07-25):单个图标按钮,点击切换 plan/act。
  // 复用 select() 保持 plan/act 切换行为与宽屏完全一致(受控/非受控分支同源)。
  const toggle = () => select(current === 'plan' ? 'act' : 'plan')
  const currentLabel = current === 'plan' ? planLabel : actLabel
  const currentTooltip = current === 'plan' ? planTooltip : actTooltip
  const CurrentIcon = current === 'plan' ? ListChecks : Play

  return (
    <div
      role="radiogroup"
      aria-label="Plan/Act mode"
      className={cn(
        'ai-panel-toggle inline-flex h-7 items-center gap-0.5 rounded-md bg-muted p-0.5',
        className,
      )}
    >
      {/* 宽屏(>= 360px):2 个文字按钮(radiogroup 语义保留供 a11y) */}
      <span className="ai-toggle-wide inline-flex items-center gap-0.5">
        {btn('plan', planLabel, planTooltip)}
        {btn('act', actLabel, actTooltip)}
      </span>
      {/* 窄屏(< 360px):单个图标按钮,点击切换 mode(plan/act)。
         故意放在 radiogroup 内部但非 role="radio",与宽屏互斥显示(由 CSS 容器查询切换),
         a11y 走 title + aria-label,屏幕阅读器同一时间只感知一种状态。 */}
      <span className="ai-toggle-narrow">
        <button
          type="button"
          onClick={toggle}
          title={currentTooltip}
          aria-label={currentLabel}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150',
            'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
          )}
        >
          <CurrentIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}
