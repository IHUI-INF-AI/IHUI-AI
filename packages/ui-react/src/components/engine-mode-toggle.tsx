// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent 执行引擎切换控件(阶段 3 第二片)
 *
 * 三态:本地 / 云端 / 自动(默认)。
 * 纯展示组件:模式值与回调由调用方注入,不直接依赖 zustand store ——
 * 这样桌面/web/扩展都能复用(各端用各自 transport 建的 engine-mode store)。
 *
 * 减负语义(见 tmp/本地云端引擎切换_核实与方案.md):
 *  - 本地:编排+工具+推理都在用户机跑,不占线上服务器(真减负)
 *  - 云端:现状,负载在服务器
 *  - 自动:沿用 base-url 自动分流(本地壳→本地,浏览器/远端壳→云端),零回归
 */
'use client'

import { cn } from '../lib/utils'
import type { EngineMode } from '@ihui/shared'

const ENGINE_MODE_LABELS: Record<EngineMode, string> = {
  local: '本地',
  cloud: '云端',
  auto: '自动',
}

export interface EngineModeToggleProps {
  /** 当前模式 */
  value: EngineMode
  /** 切换回调 */
  onChange: (m: EngineMode) => void
  /** 可选项(默认三态全开;调用方可按环境收窄,如浏览器只给 cloud/auto) */
  modes?: readonly EngineMode[]
  className?: string
  /** 无障碍标签 */
  ariaLabel?: string
  /** 禁用态(如流式期间切换引擎无意义,由调用方传入) */
  disabled?: boolean
  /**
   * 三态标签注入(2026-11-15 契约):共享组件不引 next-intl,由调用方(web 的
   * engine-mode-button 语言包)传入 —— 缺席时回落组件内置兜底文案(旧调用面零变化)。
   */
  labelMap?: Partial<Record<EngineMode, string>>
}

export function EngineModeToggle({
  value,
  onChange,
  modes = ['local', 'cloud', 'auto'],
  className,
  ariaLabel = 'agent 执行引擎',
  disabled = false,
  labelMap,
}: EngineModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5', className)}
    >
      {modes.map((m) => {
        const active = m === value
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(m)}
            className={cn(
              'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50',
              active
                ? 'bg-selection text-selection-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {/* 2026-11-15 契约:语言包标签由调用方经 labelMap 注入(共享组件不引 next-intl);
                未注入时回落内置兜底(旧调用面零行为变化)。 */}
            {labelMap?.[m] ?? ENGINE_MODE_LABELS[m]}
          </button>
        )
      })}
    </div>
  )
}

export default EngineModeToggle
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
