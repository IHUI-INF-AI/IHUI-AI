'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 表单 Switch 组件 (2026-07-22 重设)
 *
 * 视觉规范 (与 @ihui/ui Switch 同步):
 *   - Track: rounded (4px) 替代 capsule rounded-full,符合 AGENTS.md §4 圆角守门
 *   - Thumb: rounded-sm (2px) — 方形微圆角,符合"圆按钮改为正方形"用户要求
 *   - Thumb 颜色: bg-primary-foreground 亮/暗模式恒白
 *   - Thumb 阴影: shadow-sm 替代 shadow-lg
 *   - 内边距: p-[2px] 替代 border-2 border-transparent
 */
interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: React.ReactNode
  className?: string
}

const sizeMap = {
  sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'translate-x-3' },
  md: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' },
  lg: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'translate-x-5' },
}

export function Switch({ checked, onChange, disabled = false, size = 'md', label, className }: SwitchProps) {
  const s = sizeMap[size]
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2', disabled && 'cursor-not-allowed opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded p-[2px] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          s.track,
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'pointer-events-none block rounded-sm bg-primary-foreground shadow-sm ring-0 transition-transform',
            s.thumb,
            checked ? s.translate : 'translate-x-0',
          )}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}
