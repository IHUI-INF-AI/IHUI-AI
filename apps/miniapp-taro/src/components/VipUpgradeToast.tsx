import { View, Text } from '@tarojs/components'

export interface VipUpgradeToastProps {
  visible?: boolean
  desc?: string
  onUpgrade?: () => void
  onClose?: () => void
  duration?: number
}

import { useState, useEffect } from 'react'

export default function VipUpgradeToast({
  visible = false,
  desc = '升级会员解锁更多功能',
  onUpgrade,
  onClose,
  duration = 5000,
}: VipUpgradeToastProps) {
  const [show, setShow] = useState(visible)

  useEffect(() => {
    setShow(visible)
    if (visible && duration > 0) {
      const t = setTimeout(() => {
        setShow(false)
        onClose?.()
      }, duration)
      return () => clearTimeout(t)
    }
  }, [visible])

  if (!show) return null

  return (
    <View className="fixed top-4 left-0 right-0 z-40 flex justify-center px-4">
      <View
        className="flex items-center px-4 py-2.5 rounded-full shadow-lg"
        style={{ background: 'linear-gradient(90deg, #fef3c7, #fde68a)' }}
      >
        <Text className="text-base mr-2">👑</Text>
        <Text className="text-xs text-yellow-700 mr-3">{desc}</Text>
        <View
          className="px-3 py-1 rounded-full"
          style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)' }}
          onClick={onUpgrade}
        >
          <Text className="text-xs text-white font-medium">升级</Text>
        </View>
        <Text
          className="text-xs text-yellow-600 ml-2"
          onClick={() => {
            setShow(false)
            onClose?.()
          }}
        >
          ×
        </Text>
      </View>
    </View>
  )
}
