import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  View,
} from 'react-native'
import { cn } from '@ihui/design-tokens'

export interface SheetProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
  side?: 'bottom' | 'top'
}

const ANIM_DURATION = 300
const SWIPE_THRESHOLD = 80
const SCREEN_H = Dimensions.get('window').height

/**
 * RN Sheet — Radix Dialog 的移动端等价物。
 * 用 RN Modal + Animated slideUp + 遮罩层实现,支持点击遮罩或下拉关闭。
 */
export function Sheet({ open, onOpenChange, children, side = 'bottom' }: SheetProps) {
  const [modalVisible, setModalVisible] = useState(false)
  const progress = useRef(new Animated.Value(0)).current
  const drag = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (open) {
      setModalVisible(true)
      Animated.timing(progress, {
        toValue: 1,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }).start()
    } else if (modalVisible) {
      Animated.timing(progress, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }).start()
      const timer = setTimeout(() => setModalVisible(false), ANIM_DURATION)
      return () => clearTimeout(timer)
    }
  }, [open, progress, modalVisible])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (side === 'bottom') return g.dy > 5
        return g.dy < -5
      },
      onPanResponderMove: (_, g) => {
        if (side === 'bottom' && g.dy > 0) drag.setValue(g.dy)
        if (side === 'top' && g.dy < 0) drag.setValue(-g.dy)
      },
      onPanResponderRelease: (_, g) => {
        const delta = side === 'bottom' ? g.dy : -g.dy
        if (delta > SWIPE_THRESHOLD) {
          onOpenChange?.(false)
        }
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start()
      },
    }),
  ).current

  const baseTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [side === 'bottom' ? SCREEN_H : -SCREEN_H, 0],
  })
  const dragTranslate = Animated.multiply(drag, side === 'bottom' ? 1 : -1)
  const translateY = Animated.add(baseTranslate, dragTranslate)

  const close = () => onOpenChange?.(false)

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={close}>
      <Pressable className="flex-1 bg-black/50" onPress={close}>
        <Animated.View
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => e.stopPropagation()}
          style={{ transform: [{ translateY }] }}
          className={cn(
            'absolute left-0 right-0 bg-card p-6 shadow-lg',
            side === 'bottom' ? 'bottom-0 rounded-t-lg' : 'top-0 rounded-b-lg',
          )}
        >
          {/* 拖拽手柄:双层结构(外层命中区 + 内层可见细线) */}
          <View
            className="mb-4 items-center"
            hitSlop={{ top: 8, bottom: 8, left: 40, right: 40 }}
            {...panResponder.panHandlers}
          >
            <View className="h-1.5 w-10 rounded bg-border" />
          </View>
          {children}
        </Animated.View>
      </Pressable>
    </Modal>
  )
}
