// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * FloatBox 悬浮消息提示框(mobile-rn 端) —— 统一对齐 web 端 sonner 观感(M4 单一源样式)。
 *
 * 2026-11 改造(对齐 web「从顶部滑下来的弹窗」):
 * - 进场:translateY(-SLIDE) → 0 配合 opacity 0 → 1,即「从顶部上方滑下并淡入」,
 *   替代原纯淡入(原只动 opacity、原地出现,看起来不像 web 的 slide-down);
 * - 退场:opacity → 0 + translateY → -SLIDE,再 onHide;
 * - 4 种 type 用语义色实底(替代原统一深底 rgba(0,0,0,0.85)),前景统一白字白图标,
 *   对标 web sonner 的 richColors(error 红 / warning 黄 / success 绿 / info 深灰);
 * - 右上角关闭按钮(X),点击即退场,对标 sonner 的 closeButton;
 * - 时长仍由调用方 / 共享单源常量透传,本组件不再自定默认语义时长(见下方 DEFAULT_DURATION_MS)。
 *
 * 语义色底均满足 WCAG 正文 ≥4.5:1(守门见 float-box-toast-contrast.test.tsx),
 * 不再出现「深色模式看不见字」那一型(原固定深底 + 随主题翻转前景的坑已随语义色消除)。
 */
import { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
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

import { rnRadius, rnSpacing } from '@ihui/design-tokens'
// toast 上限按应用框架实际宽(430 壳)取(2026-10-15 修溢出):原用视口宽 586×0.8=450,
// 超长文案时 toast 横跨出 #root 被裁右侧;原生无 #root 回退窗口宽行为不变(与 SearchOverlay 同轨)。
import { useAppFrameWidth } from './Carousel'
import { scaleText } from '@ihui/rn-app'

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
const FADE_OUT_DURATION_MS = 200
const DEFAULT_DURATION_MS = 3000
const Z_INDEX = 9999
// styles.icon 是文本字形图标的回退样式(当前无人引用,渲染走 lucide 组件);
// 删它属逻辑清理、超出本票范围,登记见 float-box-spec 文末第 1)条。
// 该回退样式的行高**不再在端内留第二份数字**:取两端共用锚档 FLOAT_BOX_TEXT_LINE_HEIGHT_PX,
// 小程序端 FloatBox 的 caption 行高用的就是同一档(现值同为 20)—— 同锚即同值。
const ICON_FONT_SIZE = 16
const MAX_WIDTH_RATIO = 0.8
/** 进场位移:从顶部上方滑入(对标 web sonner 的 slide-down),配合 fade 形成「滑下」观感 */
const SLIDE_DISTANCE_PX = 40

/**
 * 语义色实底(对齐 web sonner richColors)。底均暗、前景统一白,满足 WCAG 正文 ≥4.5:1
 * (见 float-box-toast-contrast 守门)。
 *
 * 不再用统一深底 rgba(0,0,0,0.85):那版无法区分 error/warning/success,且与 web 的彩色弹窗
 * 观感不一致;固定深底 + 随主题翻转前景的「深色模式看不见字」坑也随之消除(底不再随主题变,
 * 前景恒白)。四档底亮度均 < 0.2,白字对比度稳过 4.5:1。
 */
export const RN_TOAST_SURFACES: Readonly<Record<FloatBoxType, { bg: string; fg: string }>> = {
  success: { bg: '#15803d', fg: '#FFFFFF' },
  error: { bg: '#b91c1c', fg: '#FFFFFF' },
  warning: { bg: '#b45309', fg: '#FFFFFF' },
  info: { bg: '#1f2937', fg: '#FFFFFF' },
}

/** 按 type 取语义色面(单一入口,供渲染与守门共用) */
export function floatBoxSurface(type: FloatBoxType): { bg: string; fg: string } {
  return RN_TOAST_SURFACES[type]
}

/** 向后兼容旧导入名(历史守门 float-box-toast-contrast 曾直接引用本常量,现为 info 面)。 */
export const FLOAT_BOX_TOAST_SURFACE = RN_TOAST_SURFACES.info

const TYPE_ICONS: Readonly<Record<FloatBoxType, LucideIcon>> = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
}

/**
 * 出口守卫:文案剥掉空白后为空 ⇒ 整枚提示不出图。
 *
 * 真机在「我的」tab 拍到一枚**只有橙色警告三角、没有任何文字**的深色方块。生产者不止一处,
 * 而且分散在不同 tab(根导航器会让已访问过的 tab 保持挂载,它们的 FloatBox 同时在场),
 * 逐个调用方补兜底文案既修不全、又会造出第二份"默认文案"真相 —— 所以判据只能落在这个唯一渲染点。
 *
 * 但**静默吞掉等于把缺陷从屏幕上挪走、日志里也没有**(§5e「失败必须响」同一条禁令),
 * 故 __DEV__ 下把类型喊出来,让"谁传了空文案"仍可诊断。
 */
export function floatBoxShouldShow(visible: boolean, message: string): boolean {
  return visible && typeof message === 'string' && message.trim() !== ''
}

export function FloatBox({
  visible,
  type,
  message,
  onHide,
  duration = DEFAULT_DURATION_MS,
}: FloatBoxProps) {
  const shown = floatBoxShouldShow(visible, message)
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-SLIDE_DISTANCE_PX)).current
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onHideRef = useRef<(() => void) | undefined>(onHide)
  onHideRef.current = onHide

  const surface = floatBoxSurface(type)
  const Icon = TYPE_ICONS[type]

  /**
   * 退场:opacity → 0 + translateY → -SLIDE,动画结束再 onHide。
   * 关闭按钮与自动计时都走它,保证「滑上去淡出」的统一观感。
   */
  const dismiss = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -SLIDE_DISTANCE_PX,
        duration: FADE_OUT_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start((res) => {
      // 真机 RN 的 start 回调恒传 { finished };测试替身的 parallel.start 以无参调用
      // (见 tests/__mocks__/react-native.ts),故这里容忍 result 缺省,不直接解构。
      if ((res as { finished?: boolean } | undefined)?.finished) onHideRef.current?.()
    })
  }, [opacity, translateY])

  useEffect(() => {
    if (visible && !shown && __DEV__) {
      console.warn(
        `[FloatBox] 收到空白文案(type=${type})已不出图 —— 请修生产者,不要在本组件补兜底文案`,
      )
    }
  }, [visible, shown, type])

  useEffect(() => {
    if (!shown) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      opacity.stopAnimation()
      translateY.stopAnimation()
      opacity.setValue(0)
      translateY.setValue(-SLIDE_DISTANCE_PX)
      return
    }

    // 进场:从顶部上方滑下 + 淡入
    opacity.setValue(0)
    translateY.setValue(-SLIDE_DISTANCE_PX)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: FADE_IN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start((res) => {
      // 同 dismiss:容忍测试替身无参回调;真机恒传 { finished }。
      if (!(res as { finished?: boolean } | undefined)?.finished) return
      // 显式标注 number 类型,避免 setTimeout 推断为 NodeJS.Timeout
      hideTimerRef.current = setTimeout(() => {
        dismiss()
      }, duration)
    })

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      opacity.stopAnimation()
      translateY.stopAnimation()
    }
  }, [shown, duration, opacity, translateY, dismiss])

  const screenWidth = useAppFrameWidth()
  const maxWidth = Math.round(screenWidth * MAX_WIDTH_RATIO)

  return (
    <Animated.View
      pointerEvents={shown ? 'auto' : 'none'}
      style={[
        styles.container,
        { maxWidth, opacity, transform: [{ translateY }], backgroundColor: surface.bg },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View style={styles.contentRow}>
        <Icon size={FLOAT_BOX_ICON_SIZE_PX} color={surface.fg} />
        <Text
          style={[styles.message, scaleText(styles.message), { color: surface.fg }]}
          numberOfLines={2}
          allowFontScaling={false}
        >
          {message}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="关闭"
        onPress={dismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <X size={16} color={surface.fg} />
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: FLOAT_BOX_TOAST_TOP_OFFSET_PX,
    alignSelf: 'center',
    zIndex: Z_INDEX,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: FLOAT_BOX_TOAST_PADDING_X_PX,
    paddingVertical: FLOAT_BOX_TOAST_PADDING_Y_PX,
    borderRadius: rnRadius.lg,
    gap: FLOAT_BOX_TOAST_ROW_GAP_PX,
  } as ViewStyle,
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FLOAT_BOX_TOAST_ROW_GAP_PX,
  } as ViewStyle,
  closeBtn: {
    marginLeft: FLOAT_BOX_TOAST_ROW_GAP_PX,
    padding: rnSpacing['2xs'],
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
  } as TextStyle,
})

// STACK_GAP 暴露给上层 Toast Portal 使用,便于按 index 累加 topOffset
export const FLOAT_BOX_STACK_GAP = FLOAT_BOX_TOAST_STACK_GAP_PX
export const FLOAT_BOX_TOP_OFFSET = FLOAT_BOX_TOAST_TOP_OFFSET_PX

export default FloatBox
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
