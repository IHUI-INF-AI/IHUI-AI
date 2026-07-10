'use client'

import * as React from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = React.useState(0)
  const fromRef = React.useRef(0)
  const rafRef = React.useRef<number>(0)

  React.useEffect(() => {
    const from = fromRef.current
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (value - from) * eased
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return (
    <span className={className}>
      {prefix}
      {display.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}
