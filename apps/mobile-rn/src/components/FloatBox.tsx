/**
 * FloatBox 悬浮消息提示框(mobile-rn 端)
 *
 * 对齐历史项目 FloatBox 组件:
 * - 顶部 TOP_OFFSET 居中悬浮,显示 duration 毫秒后自动消失(默认 3000ms)
 * - 250ms fade in → 显示 → 250ms fade out → onHide
 * - 4 种 type(success / error / warning / info),左侧图标颜色按 type 区分
 * - 浅色优雅风,无渐变/无霓虹;系统字体,无 ttf 资源
 * - 多个 FloatBox 堆叠由父容器(Toast Portal)管理:每个实例独立渲染,
 *   外层按 index 在 TOP_OFFSET 基础上累加 (itemHeight + STACK_GAP) 实现
 *   垂直堆叠;本组件自身只提供单实例定位。
 */
import { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export type FloatBoxType = 'success' | 'error' | 'warning' | 'info'

export interface FloatBoxProps {
  visible: boolean
  type: FloatBoxType
  message: string
  onHide?: () => void
  duration?: number
}

const FADE_IN_DURATION_MS = 250
const FADE_OUT_DURATION_MS = 250
const DEFAULT_DURATION_MS = 3000
const TOP_OFFSET = 80
const STACK_GAP = 8
const Z_INDEX = 9999
const ICON_SIZE = 18
const ICON_LINE_HEIGHT = 20
const ICON_FONT_SIZE = 16
const FONT_SIZE = 14
const TEXT_LINE_HEIGHT = 20
const PADDING_H = 16
const PADDING_V = 10
const BORDER_RADIUS = 8
const MAX_WIDTH_RATIO = 0.8
const ROW_GAP = 8
const TEXT_COLOR = '#FFFFFF'
const BG_COLOR = 'rgba(0,0,0,0.85)'

const TYPE_ICONS: Readonly<Record<FloatBoxType, string>> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

const TYPE_ICON_COLORS: Readonly<Record<FloatBoxType, string>> = {
  success: tokens.success.DEFAULT,
  error: tokens.danger.DEFAULT,
  warning: tokens.warning.DEFAULT,
  info: tokens.brand.DEFAULT,
}

export function FloatBox({
  visible,
  type,
  message,
  onHide,
  duration = DEFAULT_DURATION_MS,
}: FloatBoxProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onHideRef = useRef<(() => void) | undefined>(onHide)
  onHideRef.current = onHide

  useEffect(() => {
    if (!visible) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      opacity.stopAnimation()
      opacity.setValue(0)
      return
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return
      // 显式标注 number 类型,避免 setTimeout 推断为 NodeJS.Timeout
      hideTimerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT_DURATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished: fadeFinished }) => {
          if (fadeFinished) {
            onHideRef.current?.()
          }
        })
      }, duration)
    })

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      opacity.stopAnimation()
    }
  }, [visible, duration, opacity])

  const screenWidth = Dimensions.get('window').width
  const maxWidth = Math.round(screenWidth * MAX_WIDTH_RATIO)
  const iconColor = TYPE_ICON_COLORS[type]

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.container, { maxWidth, opacity }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View style={styles.contentRow}>
        <Text style={[styles.icon, { color: iconColor }]} allowFontScaling={false}>
          {TYPE_ICONS[type]}
        </Text>
        <Text style={styles.message} numberOfLines={2} allowFontScaling={false}>
          {message}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: TOP_OFFSET,
    alignSelf: 'center',
    zIndex: Z_INDEX,
    backgroundColor: BG_COLOR,
    paddingHorizontal: PADDING_H,
    paddingVertical: PADDING_V,
    borderRadius: BORDER_RADIUS,
  } as ViewStyle,
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  } as ViewStyle,
  icon: {
    width: ICON_SIZE,
    fontSize: ICON_FONT_SIZE,
    lineHeight: ICON_LINE_HEIGHT,
    textAlign: 'center',
  } as TextStyle,
  message: {
    flex: 1,
    fontSize: FONT_SIZE,
    lineHeight: TEXT_LINE_HEIGHT,
    color: TEXT_COLOR,
  } as TextStyle,
})

// STACK_GAP 暴露给上层 Toast Portal 使用,便于按 index 累加 topOffset
export const FLOAT_BOX_STACK_GAP = STACK_GAP
export const FLOAT_BOX_TOP_OFFSET = TOP_OFFSET

export default FloatBox
