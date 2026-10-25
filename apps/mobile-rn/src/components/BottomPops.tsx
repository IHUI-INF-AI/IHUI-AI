// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BottomPops 底部弹出层 (mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp bottom-pops/index.vue:
 * - 底部锚定弹出层,遮罩取 tokens.overlay.modal(亮 0.4 / 暗 0.6 随主题),点击遮罩关闭
 * - 内容卡片:顶部圆角 12(borderTopLeftRadius/borderTopRightRadius,AGENTS §4 圆角守门)
 * - 抓手条(36×4 muted 圆条):给下拉关闭手势可见 affordance(2026-10-19 增)
 * - 顶部标题栏(item-center):paddingHorizontal 20 / paddingVertical 15,flex-row space-between
 *   - 标题:fontWeight bold,fontSize 17,color text.primary
 *   - 关闭按钮:lucide X 图标(glyphMd 档),text.tertiary 颜色
 * - 内容区:可定制 children(center/bottom slot 合并为 children)
 * - 动画:translateY(100%) → 0,300ms ease-in-out(对齐 .vue transform 0.3s)
 *   - 关闭时保留 300ms 下滑动画后再卸载(对齐 .vue close() 的 setTimeout 300ms)
 *
 * 浅色优雅风,无渐变 / 无霓虹,系统字体。禁用 rounded-full,禁用分割线。
 *
 * 平台特有:依赖 RN Modal/Animated/useSafeAreaInsets,不适合共享。
 */
import { tokens } from '../theme/active-tokens'
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
import { X } from 'lucide-react-native'
import { useI18n } from '../i18n'

import { rnGeometry, rnRadius, rnSpacing } from '@ihui/design-tokens'

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

const HEADER_PADDING_H = 20
const HEADER_PADDING_V = 15
const TITLE_FONT_SIZE = 17
const CLOSE_BUTTON_SIZE = 32
const CONTENT_PADDING_H = 20
const CONTENT_PADDING_B = 16

export function BottomPops({ visible, onClose, children, title, height }: BottomPopsProps) {
  const { t } = useI18n()
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
            accessibilityLabel={t('common.closeOverlay')}
          />
        </Animated.View>

        {/* 底部内容卡片 */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }, { paddingBottom: insets.bottom }]}
        >
          {/* 标题栏(item-center:space-between,标题 + 关闭按钮)。
              抓手条在标题行上方,给 headerPanResponder 的下拉关闭手势一个可见 affordance
              (此前手势存在但零视觉暗示);pointerEvents none 让触摸直落拖拽层。 */}
          <View {...headerPanResponder.panHandlers}>
            <View style={styles.grabber} pointerEvents="none" />
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {title ?? ''}
              </Text>
              {/* 守门 131 那一型:函数形态 style 落在 Pressable 上会被 cssInterop 展开成空对象,
                  整份内联样式静默消失。closeButton 只有定尺寸与居中(无底色/描边/圆角,即无绘制),
                  故布局档以静态对象形态留在外层,只把按压态 opacity 下移到子 View 数组形态。 */}
              <Pressable
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                {({ pressed }) => (
                  <View style={pressed ? styles.closeButtonPressed : null}>
                    <X size={rnGeometry.glyphMd} color={tokens.text.tertiary} />
                  </View>
                )}
              </Pressable>
            </View>
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

// ─────────────────────────────────────────────────────────────
// AppConfirm: shared confirm sheet (replaces native Alert.alert; AGENTS §4 forbids native prompt windows).
// Imperative appAlert(title, message?, buttons?) mirrors the RN Alert.alert signature,
// reusing this file's BottomPops (inherits the grabber + branded overlay) — zero behavior change, visual unification only.
// A single <AppConfirmHost/> mounts at the App.tsx root; any caller anywhere can invoke appAlert to pop it.
// Button semantics align with RN: style 'destructive' -> danger color, 'cancel' -> secondary, others -> primary.
// ─────────────────────────────────────────────────────────────
export type AppConfirmButton = {
  text: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
}

type AppConfirmSpec = {
  title: string
  message?: string
  buttons?: AppConfirmButton[]
}

let confirmSpec: AppConfirmSpec | null = null
let confirmListeners: Array<() => void> = []

function emitConfirm(): void {
  for (const listener of confirmListeners) listener()
}

/** Imperative confirm sheet aligned to RN Alert.alert(title, message?, buttons?) — appAlert. */
export function appAlert(title: string, message?: string, buttons?: AppConfirmButton[]): void {
  confirmSpec = {
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : undefined,
  }
  emitConfirm()
}

export function AppConfirmHost() {
  const [spec, setSpec] = useState<AppConfirmSpec | null>(confirmSpec)
  useEffect(() => {
    const listener = (): void => setSpec(confirmSpec)
    confirmListeners.push(listener)
    return () => {
      confirmListeners = confirmListeners.filter((l) => l !== listener)
    }
  }, [])

  const close = (): void => {
    confirmSpec = null
    emitConfirm()
  }

  const { t } = useI18n()
  const btns = spec?.buttons ?? [{ text: t('common.confirm') }]

  const handlePress = (btn: AppConfirmButton): void => {
    close()
    btn.onPress?.()
  }

  return (
    <BottomPops visible={spec !== null} onClose={close} title={spec?.title ?? ''}>
      {spec?.message ? <Text style={styles.confirmMessage}>{spec.message}</Text> : null}
      <View style={styles.confirmActions}>
        {btns.map((btn, i) => {
          const isDanger = btn.style === 'destructive'
          const isCancel = btn.style === 'cancel'
          return (
            <Pressable
              key={i}
              style={[
                styles.confirmBtn,
                isDanger
                  ? styles.confirmBtnDanger
                  : isCancel
                    ? styles.confirmBtnCancel
                    : styles.confirmBtnPrimary,
              ]}
              onPress={() => handlePress(btn)}
              accessibilityRole="button"
              accessibilityLabel={btn.text}
            >
              <Text
                style={
                  isDanger
                    ? styles.confirmBtnDangerText
                    : isCancel
                      ? styles.confirmBtnCancelText
                      : styles.confirmBtnPrimaryText
                }
              >
                {btn.text}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </BottomPops>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  mask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tokens.overlay.modal,
  } as ViewStyle,
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius.xl,
    borderTopRightRadius: rnRadius.xl,
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
  // 下拉抓手:36×4 圆条,muted 灰压在 card 白底上刚好可见;宽度取 tapBox 档
  grabber: {
    alignSelf: 'center',
    width: rnGeometry.tapBox,
    height: 4,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    marginTop: 10,
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
  contentInner: {
    paddingHorizontal: CONTENT_PADDING_H,
    paddingBottom: CONTENT_PADDING_B,
  } as ViewStyle,
  // ── AppConfirm 确认弹层(共享,替代原生 Alert) ──
  confirmMessage: {
    fontSize: rnGeometry.textBody,
    lineHeight: rnGeometry.textBody + 6,
    color: tokens.text.secondary,
    paddingTop: rnSpacing.xs,
    paddingBottom: rnSpacing.xl,
  } as TextStyle,
  confirmActions: {
    flexDirection: 'row',
    gap: rnSpacing.md,
  } as ViewStyle,
  confirmBtn: {
    flex: 1,
    height: 48,
    // 角色=control ⇒ 必须取 sm 档(RADIUS_ROLES.control→sm,门 150);这里原来取 lg,
    // 是"按元素大就配大圆角"的直觉 —— 两端各按直觉选档时,门 77(档位表)和门 150(角色档)
    // 互相指认、无人看守,这一型就是本门立项的立因。
    borderRadius: rnRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  confirmBtnCancel: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  confirmBtnCancelText: {
    fontSize: rnGeometry.textBody,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  confirmBtnPrimary: {
    backgroundColor: tokens.brand.cta,
  } as ViewStyle,
  confirmBtnPrimaryText: {
    fontSize: rnGeometry.textBody,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  } as TextStyle,
  confirmBtnDanger: {
    backgroundColor: tokens.error.bg,
  } as ViewStyle,
  confirmBtnDangerText: {
    fontSize: rnGeometry.textBody,
    fontWeight: '600',
    color: tokens.error.text,
  } as TextStyle,
})

export default BottomPops
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
