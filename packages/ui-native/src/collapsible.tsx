import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, Text, View } from 'react-native'
import { cn } from '@ihui/design-tokens'

export interface CollapsibleProps {
  open?: boolean
  children?: ReactNode
  className?: string
}

const ANIM_DURATION = 200

/**
 * RN Collapsible — 折叠/展开动画。
 * 用 Animated + onLayout height 测量实现 height 从 0 到内容高度的动画。
 * 箭头图标随 open 状态旋转 90deg。
 */
export function Collapsible({ open = false, children, className }: CollapsibleProps) {
  const [height, setHeight] = useState(0)
  const animatedHeight = useRef(new Animated.Value(0)).current
  const arrowRotate = useRef(new Animated.Value(open ? 1 : 0)).current

  useEffect(() => {
    if (height > 0) {
      Animated.timing(animatedHeight, {
        toValue: open ? height : 0,
        duration: ANIM_DURATION,
        useNativeDriver: false,
      }).start()
    }
    Animated.timing(arrowRotate, {
      toValue: open ? 1 : 0,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start()
  }, [open, height, animatedHeight, arrowRotate])

  const arrowRotation = arrowRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  })

  return (
    <View className={cn('w-full', className)}>
      <Animated.View style={{ transform: [{ rotate: arrowRotation }] }}>
        <Text className="text-base text-foreground">{`\u203A`}</Text>
      </Animated.View>
      <View style={{ overflow: 'hidden' }}>
        <Animated.View style={{ height: animatedHeight }}>
          <View
            onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </View>
  )
}
