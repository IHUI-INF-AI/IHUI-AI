/**
 * HandPlatePops 手柄式底部弹出层 (mobile-rn 端)
 *
 * 参考历史 Uniapp hand-plate-pups/index.vue 的弹层 + 标题栏结构,
 * 按任务要求实现「手柄式底部弹出层」:
 * - 从底部弹出的内容卡片,顶部有圆角(12px,borderTopLeftRadius/borderTopRightRadius,AGENTS §4)
 * - 顶部手柄条(grab handle):36×4 圆角短条,可拖拽下拉关闭
 * - 标题栏(可选 title):居中标题
 * - 内容区:可定制 children(ScrollView 可滚动)
 * - PanResponder 实现下拉关闭:在手柄 + 标题栏区域拖拽,下拉超过阈值(80px)触发 onClose
 * - 半透明黑色遮罩 rgba(0,0,0,0.5),点击遮罩关闭
 * - 动画:translateY 屏幕高度 → 0,300ms ease-in-out;关闭保留下滑动画再卸载
 *
 * 浅色优雅风,无渐变 / 无霓虹,系统字体。禁用 rounded-full,禁用分割线。
 *
 * 平台特有:依赖 RN Modal/Animated/PanResponder/useSafeAreaInsets,不适合共享。
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
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface HandPlatePopsProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

const SCREEN_HEIGHT = Dimensions.get('window').height
const ANIM_DURATION_MS = 300
const SHEET_HIDDEN_OFFSET = SCREEN_HEIGHT
const DRAG_CLOSE_THRESHOLD = 80 // 下拉超过此阈值触发关闭

const SHEET_BORDER_RADIUS = 12
const HANDLE_WIDTH = 36
const HANDLE_HEIGHT = 4
const HANDLE_RADIUS = 2
const HANDLE_AREA_PADDING_V = 12
const HEADER_PADDING_H = 20
const HEADER_PADDING_V = 8
const TITLE_FONT_SIZE = 16
const TITLE_SPACER_WIDTH = 24 // 标题左右各放一个等宽占位,保证居中
const CONTENT_PADDING_H = 20
const CONTENT_PADDING_B = 16
const MASK_COLOR = 'rgba(0,0,0,0.5)'

export function HandPlatePops({
  visible,
  onClose,
  children,
  title,
}: HandPlatePopsProps) {
  const insets = useSafeAreaInsets()
  const [rendered, setRendered] = useState(visible)
  const translateY = useRef(new Animated.Value(SHEET_HIDDEN_OFFSET)).current
  const maskOpacity = useRef(new Animated.Value(0)).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // 打开 / 关闭动画
  useEffect(() => {
    if (visible) {
      setRendered(true)
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

  // 手柄 + 标题栏区域:可拖拽下拉关闭
  const grabPanResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
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

  const hasTitle = title !== undefined && title.length > 0

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
        <Animated.View
          pointerEvents="auto"
          style={[styles.mask, { opacity: maskOpacity }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="关闭弹出层"
          />
        </Animated.View>

        {/* 底部内容卡片(手柄式) */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }] },
            { paddingBottom: insets.bottom },
          ]}
        >
          {/* 抓取区:手柄条 + 标题栏(可拖拽下拉关闭) */}
          <View style={styles.grabZone} {...grabPanResponder.panHandlers}>
            {/* 手柄条(grab handle) */}
            <View style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
            {/* 标题栏 */}
            {hasTitle ? (
              <View style={styles.header}>
                <View style={styles.titleSpacer} />
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <View style={styles.titleSpacer} />
              </View>
            ) : null}
          </View>

          {/* 内容区 */}
          <ScrollView
            style={styles.content}
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
  grabZone: {
    paddingTop: HANDLE_AREA_PADDING_V,
  } as ViewStyle,
  handleArea: {
    alignItems: 'center',
    paddingBottom: HANDLE_AREA_PADDING_V,
  } as ViewStyle,
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_RADIUS,
    backgroundColor: tokens.border.medium,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HEADER_PADDING_H,
    paddingVertical: HEADER_PADDING_V,
  } as ViewStyle,
  titleSpacer: {
    width: TITLE_SPACER_WIDTH,
  } as ViewStyle,
  title: {
    flex: 1,
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
  } as TextStyle,
  content: {
    flexGrow: 0,
  } as ViewStyle,
  contentInner: {
    paddingHorizontal: CONTENT_PADDING_H,
    paddingBottom: CONTENT_PADDING_B,
  } as ViewStyle,
})

export default HandPlatePops
