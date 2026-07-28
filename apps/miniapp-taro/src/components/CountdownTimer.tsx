import { View, Text } from '@tarojs/components'
import { useEffect, useRef } from 'react'
import { useCountdown } from '@ihui/shared/hooks'

export interface CountdownTimerProps {
  seconds: number
  onEnd?: () => void
  autoStart?: boolean
  format?: 'mmss' | 'ss'
}

// 2026-07-28 Q-1: 复用 @ihui/shared/hooks useCountdown,消除本地 setInterval/useRef/useState 重复实现。
export default function CountdownTimer({
  seconds,
  onEnd,
  autoStart = true,
  format = 'ss',
}: CountdownTimerProps) {
  const { count, start } = useCountdown(seconds)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const prevCountRef = useRef(seconds)

  // autoStart 时自动启动倒计时(仅挂载时一次,seconds 变化不重置,与原实现一致)
  useEffect(() => {
    if (autoStart && seconds > 0) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时启动,seconds 变化不重启
  }, [])

  // 倒计时结束(count 从正数变为 0)时触发 onEnd
  useEffect(() => {
    if (prevCountRef.current > 0 && count === 0) {
      onEndRef.current?.()
    }
    prevCountRef.current = count
  }, [count])

  const display =
    format === 'mmss'
      ? `${Math.floor(count / 60)
          .toString()
          .padStart(2, '0')}:${(count % 60).toString().padStart(2, '0')}`
      : `${count}s`

  return (
    <View className="inline-flex items-center px-3 py-1 rounded-md bg-muted">
      <Text className="text-xs text-muted-foreground">{display}</Text>
    </View>
  )
}
