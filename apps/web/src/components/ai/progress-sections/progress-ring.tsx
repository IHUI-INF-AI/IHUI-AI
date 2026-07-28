'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Phase 16: 进度环组件(2026-07-28 立,对标 Trae Work)
 *
 * 功能特性:
 * - SVG 双圆环:底层 track + 顶层 progress(顺时针填充)
 * - 三种视觉态:idle(静态) / in_progress(脉冲光晕) / completed(闪光庆祝)
 * - 中心显示:百分比文字(短任务) 或 步骤计数(长任务)
 * - 平滑过渡:strokeDashoffset 使用 transition-all duration-300
 * - a11y:role=progressbar + aria-valuenow/min/max + aria-label
 *
 * 12px 紧凑尺寸,适配 popover header
 */
interface ProgressRingProps {
  /** 当前进度 0-100 */
  value: number
  /** 当前状态 */
  state?: 'idle' | 'in_progress' | 'completed'
  /** 中心显示模式 */
  centerMode?: 'percent' | 'fraction' | 'none'
  /** 分子(用于 fraction 模式) */
  numerator?: number
  /** 分母(用于 fraction 模式) */
  denominator?: number
  /** 自定义尺寸(px) */
  size?: number
  /** 自定义 stroke 宽度 */
  strokeWidth?: number
  /** 自定义 className */
  className?: string
  /** a11y 标签 */
  'aria-label'?: string
}

export const ProgressRing = React.memo(function ProgressRing({
  value,
  state = 'idle',
  centerMode = 'percent',
  numerator,
  denominator,
  size = 16,
  strokeWidth = 2,
  className,
  'aria-label': ariaLabel,
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)

  // 完成态触发一次性庆祝动画(用 key 强制重新挂载,确保每次 completed 都触发)
  const prevCompletedRef = React.useRef(false)
  const [celebrateKey, setCelebrateKey] = React.useState(0)
  React.useEffect(() => {
    if (state === 'completed' && !prevCompletedRef.current) {
      setCelebrateKey((k) => k + 1)
    }
    prevCompletedRef.current = state === 'completed'
  }, [state])

  // 中心文字
  const centerText = React.useMemo(() => {
    if (centerMode === 'none') return null
    if (centerMode === 'fraction' && numerator !== undefined && denominator !== undefined) {
      // 短任务显示分数(如 "3/6"),空间不足
      return `${numerator}/${denominator}`
    }
    // 百分比
    if (pct >= 100) return '100'
    return Math.round(pct).toString()
  }, [centerMode, numerator, denominator, pct])

  // 文字尺寸:基于 SVG 尺寸自适应(防止超出)
  const fontSize = size <= 16 ? 6 : size <= 24 ? 9 : 11

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      data-testid="progress-ring"
      data-state={state}
    >
      <svg
        className={cn(
          'h-full w-full -rotate-90',
          state === 'in_progress' && 'animate-ring-progress-pulse',
        )}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={ariaLabel ?? `${Math.round(pct)}%`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* 背景 track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="text-muted"
          stroke="currentColor"
        />
        {/* 进度 arc */}
        <circle
          key={celebrateKey}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke="currentColor"
          className={cn(
            'transition-all duration-300',
            state === 'completed'
              ? 'text-emerald-500 animate-ring-celebrate'
              : 'text-emerald-500',
            state === 'in_progress' && 'text-primary',
          )}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {/* 中心文字 / 完成态打勾 */}
      {state === 'completed' && celebrateKey > 0 ? (
        <Check
          className="absolute inset-0 m-auto text-emerald-500"
          style={{
            width: size * 0.5,
            height: size * 0.5,
          }}
          aria-hidden
        />
      ) : (
        centerText && (
          <span
            className="absolute inset-0 flex items-center justify-center font-medium tabular-nums text-foreground/70"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1 }}
            aria-hidden
          >
            {centerText}
          </span>
        )
      )}
    </div>
  )
})

export default ProgressRing
