import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface VipUpgradeToastProps {
  visible?: boolean
  desc?: string
  onUpgrade?: () => void
  onClose?: () => void
  duration?: number
}

import { useState, useEffect, useRef } from 'react'

export default function VipUpgradeToast({
  visible = false,
  desc = '升级会员解锁更多功能',
  onUpgrade,
  onClose,
  duration = 5000,
}: VipUpgradeToastProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
    <View className="fixed top-4 left-0 right-0 z-40 flex justify-center px-4">
      <View
        className="flex items-center px-4 py-2.5 rounded-md shadow-lg"
        style={{ background: 'linear-gradient(90deg, #fef3c7, #fde68a)' }}
      >
        <Text className="text-base mr-2">👑</Text>
        <Text className="text-xs text-yellow-700 mr-3">{desc}</Text>
        <View
          className="px-3 py-1 rounded-md"
          style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)' }}
          onClick={onUpgrade}
        >
          <Text className="text-xs text-white font-medium">{tt('vip.upgradeNow', '升级')}</Text>
        </View>
        <Text
          className="text-xs text-[#f59e0b] ml-2"
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
