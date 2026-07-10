'use client'

import * as React from 'react'

export interface UseCountdownReturn {
  count: number
  isRunning: boolean
  start: () => void
  pause: () => void
  reset: (seconds?: number) => void
}

/** 倒计时 Hook，常用于验证码倒计时 */
export function useCountdown(seconds: number): UseCountdownReturn {
  const [count, setCount] = React.useState(seconds)
  const [isRunning, setRunning] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = React.useCallback(() => {
    setRunning(true)
    clear()
    timerRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clear()
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clear])

  const pause = React.useCallback(() => {
    setRunning(false)
    clear()
  }, [clear])

  const reset = React.useCallback(
    (resetSeconds?: number) => {
      clear()
      setRunning(false)
      setCount(resetSeconds ?? seconds)
    },
    [clear, seconds],
  )

  React.useEffect(() => {
    return clear
  }, [clear])

  return { count, isRunning, start, pause, reset }
}
