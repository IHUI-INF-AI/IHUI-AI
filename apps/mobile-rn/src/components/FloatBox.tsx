// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { tokens } from '../theme/active-tokens'
import { AlertTriangle, Check, Info, X, type LucideIcon } from 'lucide-react-native'
import {
  FLOAT_BOX_FONT_SIZE_PX,
  FLOAT_BOX_ICON_SIZE_PX,
  FLOAT_BOX_TEXT_LINE_HEIGHT_PX,
  FLOAT_BOX_TOAST_PADDING_X_PX,
  FLOAT_BOX_TOAST_PADDING_Y_PX,
  FLOAT_BOX_TOAST_ROW_GAP_PX,
  FLOAT_BOX_TOAST_STACK_GAP_PX,
  FLOAT_BOX_TOAST_TOP_OFFSET_PX,
} from '@ihui/shared/ui/float-box-spec'

import { rnRadius } from '@ihui/design-tokens'

export type FloatBoxType = 'success' | 'error' | 'warning' | 'info'

export interface FloatBoxProps {
  visible: boolean
  type: FloatBoxType
  message: string
  onHide?: () => void
  duration?: number
}

// 几何档唯一源在 @ihui/shared/ui/float-box-spec(与小程序端 FloatBox 同表)。
// 两端同名但**不是同一 UI**:本端是顶部覆盖层 toast,小程序端是右下角悬浮按钮组 ——
// toast 载体专属档(TOP/PADDING/ROW_GAP/STACK_GAP)与两端同语义档(图标墨迹/字号/行高)的
// 裁决依据逐条写在该 spec 注释里;下面仅保留本端动画时序与无人引用的字形回退样式常量。
const FADE_IN_DURATION_MS = 250
const FADE_OUT_DURATION_MS = 250
const DEFAULT_DURATION_MS = 3000
const Z_INDEX = 9999
// styles.icon 是文本字形图标的回退样式(当前无人引用,渲染走 lucide 组件);
// 删它属逻辑清理、超出本票范围,登记见 float-box-spec 文末第 1)条。
// 该回退样式的行高**不再在端内留第二份数字**:取两端共用锚档 FLOAT_BOX_TEXT_LINE_HEIGHT_PX,
// 小程序端 FloatBox 的 caption 行高用的就是同一档(现值同为 20)—— 同锚即同值。
// 剩下的 ICON_FONT_SIZE=16 无任何锚可取(web 端无同一元素:float-indicator 是滚动圆点轨、
// Toaster 无几何),且它所在样式根本不被引用 ⇒ 不在本票"收档"范围,须记 waiver(见交付报告)。
const ICON_FONT_SIZE = 16
const MAX_WIDTH_RATIO = 0.8
const TEXT_COLOR = tokens.surface.light
const BG_COLOR = 'rgba(0,0,0,0.85)'

const TYPE_ICONS: Readonly<Record<FloatBoxType, LucideIcon>> = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
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
  const Icon = TYPE_ICONS[type]

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.container, { maxWidth, opacity }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View style={styles.contentRow}>
        <Icon size={FLOAT_BOX_ICON_SIZE_PX} color={iconColor} />
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
    top: FLOAT_BOX_TOAST_TOP_OFFSET_PX,
    alignSelf: 'center',
    zIndex: Z_INDEX,
    backgroundColor: BG_COLOR,
    paddingHorizontal: FLOAT_BOX_TOAST_PADDING_X_PX,
    paddingVertical: FLOAT_BOX_TOAST_PADDING_Y_PX,
    borderRadius: rnRadius.lg,
  } as ViewStyle,
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FLOAT_BOX_TOAST_ROW_GAP_PX,
  } as ViewStyle,
  icon: {
    width: FLOAT_BOX_ICON_SIZE_PX,
    fontSize: ICON_FONT_SIZE,
    lineHeight: FLOAT_BOX_TEXT_LINE_HEIGHT_PX,
    textAlign: 'center',
  } as TextStyle,
  message: {
    flex: 1,
    fontSize: FLOAT_BOX_FONT_SIZE_PX,
    lineHeight: FLOAT_BOX_TEXT_LINE_HEIGHT_PX,
    color: TEXT_COLOR,
  } as TextStyle,
})

// STACK_GAP 暴露给上层 Toast Portal 使用,便于按 index 累加 topOffset
export const FLOAT_BOX_STACK_GAP = FLOAT_BOX_TOAST_STACK_GAP_PX
export const FLOAT_BOX_TOP_OFFSET = FLOAT_BOX_TOAST_TOP_OFFSET_PX

export default FloatBox
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
