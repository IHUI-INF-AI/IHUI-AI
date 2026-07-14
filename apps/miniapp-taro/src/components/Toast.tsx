import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'

export interface ToastProps {
  visible?: boolean
  type?: 'success' | 'error' | 'warning' | 'info'
  text?: string
  duration?: number
  onClose?: () => void
}

const COLORS: Record<string, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-orange-500',
  info: 'bg-indigo-500',
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

  useEffect(() => {
    setShow(visible)
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        setShow(false)
        onClose?.()
      }, duration)
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
