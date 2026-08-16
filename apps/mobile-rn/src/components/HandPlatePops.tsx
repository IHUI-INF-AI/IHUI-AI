/**
 * HandPlatePops 手柄式底部弹出层 (mobile-rn 端)
 *
 * 参考历史 Uniapp hand-plate-pups/index.vue(浅色版会员购买支付弹窗)的弹层结构,
 * 按任务要求实现「手柄式底部弹出层」,并在保留 children 抽屉能力的前提下新增「会员购买」模式:
 * - 从底部弹出的内容卡片,顶部有圆角(12px,borderTopLeftRadius/borderTopRightRadius,AGENTS §4)
 * - 顶部手柄条(grab handle):36×4 圆角短条,可拖拽下拉关闭
 * - 标题栏(可选 title):居中标题(会员购买模式默认 "会员购买")
 * - 内容区:默认渲染 children(ScrollView 可滚动);传入 purchase 后渲染会员购买内容
 * - PanResponder 实现下拉关闭:在手柄 + 标题栏区域拖拽,下拉超过阈值(80px)触发 onClose
 * - 半透明黑色遮罩 rgba(0,0,0,0.5),点击遮罩关闭
 * - 动画:translateY 屏幕高度 → 0,300ms ease-in-out;关闭保留下滑动画再卸载
 *
 * 会员购买模式(purchase)与 ConfirmPurchasePopUp 的差异:
 * - 原版 hand-plate-pups 为「浅色版」会员购买弹窗(浅灰底 + 黑描边按钮),ConfirmPurchasePopUp 为深色版
 * - 本组件复用底部抽屉容器,产品名/价格/划线原价/权益(5条)/微信支付单选/协议勾选/支付按钮同源
 * - 支付流程:微信支付(createPayOrder→微信支付→checkOrderStatus→updateUserVipStatus)
 *   依赖后端 + 微信支付 SDK,以 onPay 回调预留,待接后端/微信支付,不引入新原生依赖
 *
 * 浅色优雅风,无渐变 / 无霓虹,系统字体。禁用 rounded-full,禁用分割线。
 *
 * 平台特有:依赖 RN Modal/Animated/PanResponder/useSafeAreaInsets,不适合共享。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
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

export interface HandPlatePaymentMethod {
  id: string
  name: string
  /** 支付图标区文字(如微信 "微"),默认取 name 首字 */
  icon?: string
}

/** 会员购买模式配置(对齐原版 hand-plate-pups 的会员购买内容) */
export interface HandPlatePurchaseConfig {
  /** 产品名(对齐 Uniapp "AI智汇社 VIP会员") */
  productName: string
  /** 产品图标(emoji,可选) */
  icon?: string
  /** 现价(元) */
  price: number
  /** 原价(划线价,可选) */
  originalPrice?: number
  /** 权益列表(5 条,最后一条高亮) */
  benefits?: string[]
  /** 支付方式列表(单选 radio,默认 [{id:'wxpay',name:'微信支付',icon:'微'}]) */
  paymentMethods?: HandPlatePaymentMethod[]
  /** 当前选中支付方式(受控;不传则内部维护,默认第一项) */
  payMethod?: string
  /** 支付方式切换回调 */
  onPayMethodChange?: (methodId: string) => void
  /** 协议文案(对齐 Uniapp "点击立即支付，表示同意《用户协议》") */
  agreementText?: string
  /** 是否已同意协议(受控;不传则内部维护,默认 false) */
  agreed?: boolean
  /** 协议勾选切换回调 */
  onAgreeChange?: (agreed: boolean) => void
  /** 协议链接点击回调(对齐 Uniapp openAgreement) */
  onAgreementPress?: () => void
  /** 支付按钮文案(默认 "立即支付 ¥X") */
  payText?: string
  /** 支付进行中 */
  loading?: boolean
}

export interface HandPlatePopsProps {
  visible: boolean
  onClose: () => void
  children?: React.ReactNode
  title?: string
  /** 会员购买模式:传入后渲染购买内容(产品/价格/权益/支付按钮),替代 children */
  purchase?: HandPlatePurchaseConfig
  /** 完整支付回调(createPayOrder→微信支付→checkOrderStatus→updateUserVipStatus),待接后端/微信支付 */
  onPay?: () => void
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

const RADIO_SIZE = 18
const CHECKBOX_SIZE = 16

/** 默认微信支付单选(会员购买模式) */
const DEFAULT_PAYMENT_METHODS: HandPlatePaymentMethod[] = [
  { id: 'wxpay', name: '微信支付', icon: '微' },
]

function formatYuan(price: number): string {
  if (!Number.isFinite(price)) return '0'
  return price % 1 === 0 ? String(price) : price.toFixed(2)
}

export function HandPlatePops({
  visible,
  onClose,
  children,
  title,
  purchase,
  onPay,
}: HandPlatePopsProps) {
  const insets = useSafeAreaInsets()
  const [rendered, setRendered] = useState(visible)
  const [internalPayMethod, setInternalPayMethod] = useState<string | null>(null)
  const [internalAgreed, setInternalAgreed] = useState(false)
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

  // ---- 会员购买模式派生状态 ----
  const payOptions: HandPlatePaymentMethod[] =
    purchase?.paymentMethods && purchase.paymentMethods.length > 0
      ? purchase.paymentMethods
      : DEFAULT_PAYMENT_METHODS
  const selectedPayMethod =
    purchase?.payMethod ??
    internalPayMethod ??
    (payOptions.length > 0 ? payOptions[0]?.id : undefined)
  const hasAgreement = Boolean(purchase?.agreementText)
  const isAgreed = purchase?.agreed ?? internalAgreed
  const payDisabled = (purchase?.loading ?? false) || (hasAgreement && !isAgreed)

  const selectPayMethod = (methodId: string) => {
    if (purchase?.payMethod === undefined) setInternalPayMethod(methodId)
    purchase?.onPayMethodChange?.(methodId)
  }

  const toggleAgree = () => {
    const next = !isAgreed
    if (purchase?.agreed === undefined) setInternalAgreed(next)
    purchase?.onAgreeChange?.(next)
  }

  const handlePay = () => {
    if (payDisabled) return
    onPay?.()
  }

  const effectiveTitle = title ?? (purchase ? '会员购买' : undefined)
  const hasTitle = effectiveTitle !== undefined && effectiveTitle.length > 0

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

        {/* 底部内容卡片(手柄式) */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }, { paddingBottom: insets.bottom }]}
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
                  {effectiveTitle}
                </Text>
                <View style={styles.titleSpacer} />
              </View>
            ) : null}
          </View>

          {/* 内容区:会员购买模式渲染购买内容,否则渲染 children */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
          >
            {purchase ? (
              <View style={styles.purchaseWrap}>
                <Text style={styles.purchaseName} numberOfLines={2}>
                  {purchase.productName}
                </Text>
                <View style={styles.purchasePriceRow}>
                  <Text style={styles.purchaseSymbol}>¥</Text>
                  <Text style={styles.purchasePrice}>{formatYuan(purchase.price)}</Text>
                  {purchase.originalPrice && purchase.originalPrice > purchase.price ? (
                    <Text style={styles.purchaseOriginal}>
                      ¥{formatYuan(purchase.originalPrice)}
                    </Text>
                  ) : null}
                </View>

                {purchase.benefits && purchase.benefits.length > 0 ? (
                  <View style={styles.purchaseBenefits}>
                    {purchase.benefits.map((b, i) => (
                      <Text
                        key={`${b}-${i}`}
                        style={
                          i === purchase.benefits!.length - 1
                            ? styles.purchaseBenefitHighlight
                            : styles.purchaseBenefit
                        }
                      >
                        {'✓ '}
                        {b}
                      </Text>
                    ))}
                  </View>
                ) : null}

                <View style={styles.purchasePayment}>
                  <Text style={styles.purchasePaymentTitle}>{'支付方式'}</Text>
                  {payOptions.map((m) => {
                    const active = m.id === selectedPayMethod
                    return (
                      <Pressable
                        key={m.id}
                        style={[
                          styles.purchasePaymentOption,
                          active ? styles.purchasePaymentOptionActive : null,
                        ]}
                        onPress={() => selectPayMethod(m.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                      >
                        <View style={styles.purchasePaymentIcon}>
                          <Text style={styles.purchasePaymentIconText} allowFontScaling={false}>
                            {m.icon ?? m.name.charAt(0)}
                          </Text>
                        </View>
                        <Text style={styles.purchasePaymentName}>{m.name}</Text>
                        <View style={[styles.radio, active ? styles.radioActive : null]}>
                          {active ? <View style={styles.radioDot} /> : null}
                        </View>
                      </Pressable>
                    )
                  })}
                </View>

                {hasAgreement ? (
                  <View style={styles.purchaseAgreement}>
                    <Pressable
                      style={[styles.checkbox, isAgreed ? styles.checkboxChecked : null]}
                      onPress={toggleAgree}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isAgreed }}
                      accessibilityLabel={purchase.agreementText}
                    >
                      {isAgreed ? (
                        <Text style={styles.checkboxMark} allowFontScaling={false}>
                          ✓
                        </Text>
                      ) : null}
                    </Pressable>
                    <Pressable
                      style={styles.purchaseAgreementTextWrap}
                      onPress={purchase.onAgreementPress}
                      disabled={!purchase.onAgreementPress}
                    >
                      <Text style={styles.purchaseAgreementText}>{purchase.agreementText}</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable
                  style={[
                    styles.purchasePayBtn,
                    payDisabled ? styles.purchasePayBtnDisabled : null,
                  ]}
                  onPress={handlePay}
                  disabled={payDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={purchase.payText ?? '立即支付'}
                >
                  {purchase.loading ? (
                    <ActivityIndicator size="small" color={tokens.surface.light} />
                  ) : (
                    <Text style={styles.purchasePayBtnText}>
                      {purchase.payText ?? `立即支付 ¥${formatYuan(purchase.price)}`}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              children
            )}
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
  // ---- 会员购买模式 ----
  purchaseWrap: {
    paddingVertical: 8,
    gap: 12,
  } as ViewStyle,
  purchaseName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
  } as TextStyle,
  purchasePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  } as ViewStyle,
  purchaseSymbol: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: tokens.success.DEFAULT,
  } as TextStyle,
  purchasePrice: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: tokens.success.DEFAULT,
  } as TextStyle,
  purchaseOriginal: {
    fontSize: 13,
    lineHeight: 18,
    color: tokens.text.tertiary,
    textDecorationLine: 'line-through',
  } as TextStyle,
  purchaseBenefits: {
    gap: 4,
  } as ViewStyle,
  purchaseBenefit: {
    fontSize: 14,
    lineHeight: 22,
    color: tokens.text.secondary,
  } as TextStyle,
  purchaseBenefitHighlight: {
    fontSize: 14,
    lineHeight: 22,
    color: tokens.warning.deep,
    fontWeight: '600',
  } as TextStyle,
  purchasePayment: {
    gap: 6,
  } as ViewStyle,
  purchasePaymentTitle: {
    fontSize: 12,
    color: tokens.text.tertiary,
  } as TextStyle,
  purchasePaymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  } as ViewStyle,
  purchasePaymentOptionActive: {
    backgroundColor: tokens.success.lighter,
    borderColor: tokens.success.DEFAULT,
  } as ViewStyle,
  purchasePaymentIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: tokens.success.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  purchasePaymentIconText: {
    fontSize: 12,
    color: tokens.surface.light,
    fontWeight: '700',
  } as TextStyle,
  purchasePaymentName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: tokens.text.primary,
  } as TextStyle,
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 1.5,
    borderColor: tokens.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  radioActive: {
    borderColor: tokens.success.DEFAULT,
  } as ViewStyle,
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.success.DEFAULT,
  } as ViewStyle,
  purchaseAgreement: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  } as ViewStyle,
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  checkboxChecked: {
    backgroundColor: tokens.success.DEFAULT,
    borderColor: tokens.success.DEFAULT,
  } as ViewStyle,
  checkboxMark: {
    fontSize: 11,
    lineHeight: 13,
    color: tokens.surface.light,
    fontWeight: '700',
  } as TextStyle,
  purchaseAgreementTextWrap: {
    flexShrink: 1,
  } as ViewStyle,
  purchaseAgreementText: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.text.secondary,
  } as TextStyle,
  purchasePayBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  } as ViewStyle,
  purchasePayBtnDisabled: {
    opacity: 0.6,
  } as ViewStyle,
  purchasePayBtnText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.surface.light,
  } as TextStyle,
})

export default HandPlatePops
