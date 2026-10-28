// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, Modal, Pressable, Text, View, type ViewStyle } from 'react-native'
import { cn } from '@ihui/design-tokens'
import {
  TOOLTIP_GAP_PX,
  TOOLTIP_PADDING_X_PX,
  TOOLTIP_PADDING_Y_PX,
  TOOLTIP_RADIUS_TIER,
  TOOLTIP_SHADOW_TIER,
  TOOLTIP_TEXT_TIER,
} from '@ihui/shared/ui/tooltip-spec'

/**
 * 平台专属项(不下沉 tooltip-spec,两端允许不同形,逐条登记):
 *  - `ANIM_DURATION` / `MAX_WIDTH`:本端单端档,web 端没有对应槽位(属产品定档,spec 头注已登记待裁);
 *  - `delayLongPress={300}` 长按触发:移动端无 hover 通道,web 是 hover/focus(规则6 机制差,不下沉);
 *  - `Modal` + `measureInWindow` 自绘定位:本端的定位承载,web 走 Radix Popper 的 `sideOffset` prop;
 *  - `border-border`:nativewind 不继承 web tokens 的边框默认色,须显式给边框色类;
 *  - 无 `z-popover` / `overflow-hidden` / Arrow:本端没有 z-index 通道、不经父容器裁剪、无箭头件;
 *  - 字色落内层 Text:View 不着字色(web 落在 Content 根);
 *  - 类名字面量:必须留在本文件 —— nativewind 只扫本包源,spec 文件不在扫描面内,拼串产不出规则。
 *  ⇒ 取值档一律取自 tooltip-spec,本文件只做"档 → 本端承载类"的映射。
 */
const RADIUS_CLASS: Record<typeof TOOLTIP_RADIUS_TIER, string> = { md: 'rounded-md' }
const PADDING_X_CLASS: Record<number, string> = { 12: 'px-3' }
const PADDING_Y_CLASS: Record<number, string> = { 6: 'py-1.5' }
const TEXT_CLASS: Record<typeof TOOLTIP_TEXT_TIER, string> = { xs: 'text-xs' }
const SHADOW_CLASS: Record<typeof TOOLTIP_SHADOW_TIER, string> = { md: 'shadow-md' }

export interface TooltipProps {
  children: ReactNode
  content: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

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
        return { left: x + width / 2 - cw / 2, top: y - ch - TOOLTIP_GAP_PX }
      case 'bottom':
        return { left: x + width / 2 - cw / 2, top: y + height + TOOLTIP_GAP_PX }
      case 'left':
        return { left: x - cw - TOOLTIP_GAP_PX, top: y + height / 2 - ch / 2 }
      case 'right':
        return { left: x + width + TOOLTIP_GAP_PX, top: y + height / 2 - ch / 2 }
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
            <View
              className={cn(
                'border border-border bg-popover',
                RADIUS_CLASS[TOOLTIP_RADIUS_TIER],
                PADDING_X_CLASS[TOOLTIP_PADDING_X_PX],
                PADDING_Y_CLASS[TOOLTIP_PADDING_Y_PX],
                SHADOW_CLASS[TOOLTIP_SHADOW_TIER],
              )}
            >
              <Text
                className={cn(TEXT_CLASS[TOOLTIP_TEXT_TIER], 'text-popover-foreground')}
                numberOfLines={2}
              >
                {content}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
