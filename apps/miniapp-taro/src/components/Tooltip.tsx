import { View, Text } from '@tarojs/components'
import { useState } from 'react'

export interface TooltipProps {
  text: string
  children?: React.ReactNode
  placement?: 'top' | 'bottom'
}

export default function Tooltip({ text, children, placement = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <View className="relative inline-block">
      <View onClick={() => setShow(!show)} onTouchStart={() => setShow(true)}>
        {children}
      </View>
      {show && (
        <View
          className={`absolute z-20 left-1/2 px-2 py-1 bg-gray-800 rounded whitespace-nowrap ${
            placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
          style={{ transform: 'translateX(-50%)' }}
          onClick={() => setShow(false)}
        >
          <Text className="text-xs text-white">{text}</Text>
        </View>
      )}
    </View>
  )
}
