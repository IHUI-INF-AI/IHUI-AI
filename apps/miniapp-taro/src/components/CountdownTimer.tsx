import { View, Text } from '@tarojs/components'
import { useState, useEffect, useRef } from 'react'

export interface CountdownTimerProps {
  seconds: number
  onEnd?: () => void
  autoStart?: boolean
  format?: 'mmss' | 'ss'
}

export default function CountdownTimer({
  seconds,
  onEnd,
  autoStart = true,
  format = 'ss',
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(autoStart)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const remainingRef = useRef(remaining)
  remainingRef.current = remaining

  useEffect(() => {
    if (running && remainingRef.current > 0) {
      timerRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false)
            onEndRef.current?.()
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [running])

  const display =
    format === 'mmss'
      ? `${Math.floor(remaining / 60)
          .toString()
          .padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`
      : `${remaining}s`

  return (
    <View className="inline-flex items-center px-3 py-1 rounded-md bg-gray-50">
      <Text className="text-xs text-gray-500">{display}</Text>
    </View>
  )
}
