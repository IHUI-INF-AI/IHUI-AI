import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, Modal, Pressable, Text, View, type ViewStyle } from 'react-native'

export interface TooltipProps {
  children: ReactNode
  content: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

const TOOLTIP_GAP = 8
const ANIM_DURATION = 150
const MAX_WIDTH = 240

interface TriggerRect {
  x: number
  y: number
  width: number
  height: number
}

interface ContentSize {
  width: number
  height: number
}

/**
 * RN Tooltip — 长按触发(RN 移动端无 hover)。
 * 用 RN Modal + Animated fadeIn 实现,根据 trigger 元素的 measureInWindow 进行 side 定位。
 */
export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<TriggerRect | null>(null)
  const [contentSize, setContentSize] = useState<ContentSize | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const triggerRef = useRef<View>(null)

  const show = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setRect({ x, y, width, height })
      setVisible(true)
    })
  }, [])

  const hide = useCallback(() => setVisible(false), [])

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }).start()
    } else {
      opacity.setValue(0)
    }
  }, [visible, opacity])

  const computePosition = (): ViewStyle => {
    if (!rect || !contentSize) return { opacity: 0 }
    const { x, y, width, height } = rect
    const { width: cw, height: ch } = contentSize
    switch (side) {
      case 'top':
        return { left: x + width / 2 - cw / 2, top: y - ch - TOOLTIP_GAP }
      case 'bottom':
        return { left: x + width / 2 - cw / 2, top: y + height + TOOLTIP_GAP }
      case 'left':
        return { left: x - cw - TOOLTIP_GAP, top: y + height / 2 - ch / 2 }
      case 'right':
        return { left: x + width + TOOLTIP_GAP, top: y + height / 2 - ch / 2 }
    }
  }

  return (
    <>
      <Pressable ref={triggerRef} onLongPress={show} delayLongPress={300}>
        {children}
      </Pressable>
      <Modal visible={visible} transparent animationType="none" onRequestClose={hide}>
        <Pressable className="flex-1" onPress={hide}>
          <Animated.View
            pointerEvents="none"
            onLayout={(e) =>
              setContentSize({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              })
            }
            style={[{ position: 'absolute', opacity, maxWidth: MAX_WIDTH }, computePosition()]}
          >
            <View className="rounded-md border border-border bg-popover px-3 py-1.5 shadow-md">
              <Text className="text-xs text-popover-foreground" numberOfLines={2}>
                {content}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  )
}
