'use client'

/**
 * 倒计时组件
 *
 * 用于扫码登录等需要时间限制的场景,显示 MM:SS 格式倒计时。
 * 最后 60 秒变红 + 闪烁;unmount 时清理 setInterval。
 * onExpire 在剩余 0 秒时调用一次。
 *
 * AGENTS.md §4:rounded-md / 无分割线 / subtle 配色 / 禁渐变遮罩
 */

import * as React from 'react'
import { Timer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export interface CountdownTimerProps {
  readonly totalSeconds: number
  readonly onExpire?: () => void
  readonly variant?: 'default' | 'warning' | 'danger'
  readonly showIcon?: boolean
}

const DANGER_THRESHOLD_SECONDS = 60

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function CountdownTimer({
  totalSeconds,
  onExpire,
  variant = 'default',
  showIcon = true,
}: CountdownTimerProps) {
  const t = useTranslations('publish')
  const [remaining, setRemaining] = React.useState(totalSeconds)
  const expiredRef = React.useRef(false)

  React.useEffect(() => {
    setRemaining(totalSeconds)
    expiredRef.current = false
  }, [totalSeconds])

  React.useEffect(() => {
    if (totalSeconds <= 0) return
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          if (!expiredRef.current) {
            expiredRef.current = true
            onExpire?.()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [totalSeconds, onExpire])

  const isDanger = remaining <= DANGER_THRESHOLD_SECONDS
  const resolvedVariant = isDanger ? 'danger' : variant
  const variantClass =
    resolvedVariant === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : resolvedVariant === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
        variantClass,
        isDanger && 'animate-pulse',
      )}
      role="timer"
      aria-live="polite"
    >
      {showIcon && <Timer className="h-3 w-3" />}
      <span>{t('countdownRemaining')}</span>
      <span className="font-mono">{fmt(remaining)}</span>
    </span>
  )
}
