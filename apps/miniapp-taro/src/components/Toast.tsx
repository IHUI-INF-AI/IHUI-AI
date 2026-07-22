import { View, Text } from '@tarojs/components'
import { useState, useEffect, useRef } from 'react'

export interface ToastProps {
  visible?: boolean
  type?: 'success' | 'error' | 'warning' | 'info'
  text?: string
  duration?: number
  onClose?: () => void
}

const COLORS: Record<string, string> = {
  success: 'bg-primary',
  error: 'bg-destructive',
  warning: 'bg-[#f59e0b]',
  info: 'bg-primary',
}

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
}

export default function Toast({
  visible = false,
  type = 'info',
  text = '',
  duration = 2000,
  onClose,
}: ToastProps) {
  const [show, setShow] = useState(visible)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const durationRef = useRef(duration)
  durationRef.current = duration

  useEffect(() => {
    setShow(visible)
    if (visible && durationRef.current > 0) {
      const timer = setTimeout(() => {
        setShow(false)
        onCloseRef.current?.()
      }, durationRef.current)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!show) return null

  return (
    <View className="fixed top-1/2 left-1/2 z-50" style={{ transform: 'translate(-50%, -50%)' }}>
      <View className={`${COLORS[type]} px-4 py-3 rounded-lg shadow-lg max-w-xs`}>
        <View className="flex items-center">
          <Text className="text-sm text-white font-medium mr-2">{ICONS[type]}</Text>
          <Text className="text-sm text-white">{text}</Text>
        </View>
      </View>
    </View>
  )
}
