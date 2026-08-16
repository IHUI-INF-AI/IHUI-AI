/**
 * BottomPops 底部弹出层 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp bottom-pops/index.vue:
 * - 底部锚定弹出层,半透明黑色遮罩 rgba(0,0,0,0.5),点击遮罩关闭
 * - 内容卡片:顶部圆角 12(borderTopLeftRadius/borderTopRightRadius,AGENTS §4 圆角守门)
 * - 顶部标题栏(item-center):paddingHorizontal 20 / paddingVertical 15,flex-row space-between
 *   - 标题:fontWeight bold,fontSize 17,color text.primary
 *   - 关闭按钮:× 图标,text.tertiary 颜色
 * - 内容区:可定制 children(center/bottom slot 合并为 children)
 * - 动画:translateY(100%) → 0,300ms ease-in-out(对齐 .vue transform 0.3s)
 *   - 关闭时保留 300ms 下滑动画后再卸载(对齐 .vue close() 的 setTimeout 300ms)
 *
 * 浅色优雅风,无渐变 / 无霓虹,系统字体。禁用 rounded-full,禁用分割线。
 *
 * 平台特有:依赖 RN Modal/Animated/useSafeAreaInsets,不适合共享。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  type PanResponderInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface BottomPopsProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  /** 内容区高度,默认 'auto'(随内容撑开)。传数字则内容区固定高度可滚动。 */
  height?: number | string
}

const SCREEN_HEIGHT = Dimensions.get('window').height
const ANIM_DURATION_MS = 300
const SHEET_HIDDEN_OFFSET = SCREEN_HEIGHT // translateY 隐藏位置(屏幕高度,确保完全滑出)
const DRAG_CLOSE_THRESHOLD = 80 // 下拉超过此阈值触发关闭

const SHEET_BORDER_RADIUS = 12 // borderTopLeftRadius/borderTopRightRadius(AGENTS §4 rounded-t-xl)
const HEADER_PADDING_H = 20
const HEADER_PADDING_V = 15
const TITLE_FONT_SIZE = 17
const CLOSE_BUTTON_SIZE = 32
const CLOSE_ICON_FONT_SIZE = 22
const CONTENT_PADDING_H = 20
const CONTENT_PADDING_B = 16
const MASK_COLOR = 'rgba(0,0,0,0.5)'

export function BottomPops({ visible, onClose, children, title, height }: BottomPopsProps) {
  const insets = useSafeAreaInsets()
  const [rendered, setRendered] = useState(visible)
  const translateY = useRef(new Animated.Value(SHEET_HIDDEN_OFFSET)).current
  const maskOpacity = useRef(new Animated.Value(0)).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // 打开 / 关闭动画(对齐 .vue watch isShow + showPopup)
  useEffect(() => {
    if (visible) {
      setRendered(true)
      // 下一帧触发滑入(.vue 用 $nextTick + setTimeout 20ms)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIM_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(maskOpacity, {
          toValue: 1,
          duration: ANIM_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start()
    } else if (rendered) {
      // 关闭:先播 300ms 下滑动画再卸载(对齐 .vue close() setTimeout 300ms)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HIDDEN_OFFSET,
          duration: ANIM_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(maskOpacity, {
          toValue: 0,
          duration: ANIM_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => setRendered(false))
    }
  }, [visible, rendered, translateY, maskOpacity])

  // 遮罩 / 标题栏下拉关闭(增强交互,对齐现代底部弹出层体验)
  const headerPanResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        translateY.setValue(Math.max(0, g.dy))
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > DRAG_CLOSE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: SHEET_HIDDEN_OFFSET,
              duration: ANIM_DURATION_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(maskOpacity, {
              toValue: 0,
              duration: ANIM_DURATION_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]).start(() => {
            setRendered(false)
            onCloseRef.current()
          })
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start()
      },
    }),
  ).current

  const handleClose = () => {
    onCloseRef.current()
  }

  if (!rendered) return null

  const contentHeightStyle: { height: DimensionValue } | undefined =
    height !== undefined ? { height: height as DimensionValue } : undefined

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* 半透明遮罩(点击关闭) */}
        <Animated.View pointerEvents="auto" style={[styles.mask, { opacity: maskOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="关闭弹出层"
          />
        </Animated.View>

        {/* 底部内容卡片 */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }, { paddingBottom: insets.bottom }]}
        >
          {/* 标题栏(item-center:space-between,标题 + 关闭按钮) */}
          <View style={styles.header} {...headerPanResponder.panHandlers}>
            <Text style={styles.title} numberOfLines={1}>
              {title ?? ''}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed ? styles.closeButtonPressed : null,
              ]}
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <Text style={styles.closeIcon} allowFontScaling={false}>
                {'\u00D7'}
              </Text>
            </Pressable>
          </View>

          {/* 内容区(center + bottom slot 合并为 children) */}
          <ScrollView
            style={contentHeightStyle}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  mask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: MASK_COLOR,
  } as ViewStyle,
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: SHEET_BORDER_RADIUS,
    borderTopRightRadius: SHEET_BORDER_RADIUS,
    overflow: 'hidden',
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HEADER_PADDING_H,
    paddingVertical: HEADER_PADDING_V,
  } as ViewStyle,
  title: {
    flex: 1,
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 4,
    fontWeight: '700',
    color: tokens.text.primary,
  } as TextStyle,
  closeButton: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  closeButtonPressed: {
    opacity: 0.5,
  } as ViewStyle,
  closeIcon: {
    fontSize: CLOSE_ICON_FONT_SIZE,
    lineHeight: CLOSE_ICON_FONT_SIZE + 2,
    color: tokens.text.tertiary,
    fontWeight: '300',
    textAlign: 'center',
  } as TextStyle,
  contentInner: {
    paddingHorizontal: CONTENT_PADDING_H,
    paddingBottom: CONTENT_PADDING_B,
  } as ViewStyle,
})

export default BottomPops
