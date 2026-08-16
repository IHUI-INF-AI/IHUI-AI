/**
 * ConfirmPurchasePopUp 确认购买弹窗(mobile-rn 端)
 *
 * 对齐历史项目 ConfirmPurchasePopUp(会员购买支付弹窗):
 * - Modal 居中弹窗,透明背景 + 半透明黑色遮罩(rgba(0,0,0,0.5))
 * - 卡片:maxWidth 320,圆角 12,内边距 24/20,surface.card 浅灰底
 * - 顶部:48×48 圆形图标(success.lighter 背景 + 居中 ✓,success.DEFAULT 颜色)
 * - 标题:18/600/text.primary,居中,marginTop 16
 * - 商品信息行:surface.muted 圆角 8 容器 + 商品图(emoji)+ 名/价(可带划线原价)
 * - 权益列表(benefits):"✓ 权益" 逐条,最后一条高亮(warning.deep 橙,对齐原版 highlight)
 * - 支付方式(paymentMethods):单选 radio,微信支付默认选中,可切换(onPayMethodChange)
 * - 用户协议(agreementText):勾选框 + 文案,未勾选时禁用支付按钮(onAgreeChange)
 * - 按钮行:取消(描边) + 支付/确认(success.DEFAULT 底;会员模式文案 "立即支付 ¥X")
 * - 支付流程:微信支付(createPayOrder→微信支付→checkOrderStatus→updateUserVipStatus)
 *   依赖后端 + 微信支付 SDK,以 onPay 回调预留,待接后端/微信支付,不引入新原生依赖
 * - 浅色优雅风,无渐变无霓虹,系统字体
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

export interface ConfirmPurchaseProduct {
  name: string
  price: number
  icon?: string
  /** 原价(划线价,可选,对齐 Uniapp price-original) */
  originalPrice?: number
}

export interface ConfirmPaymentMethod {
  id: string
  name: string
  /** 支付图标区文字(如微信 "微"),默认取 name 首字 */
  icon?: string
}

export interface ConfirmPurchasePopUpProps {
  visible: boolean
  title: string
  message: string
  product: ConfirmPurchaseProduct
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
  cancelText?: string
  confirmText?: string
  /** 权益列表(对齐 Uniapp benefit-item "✓ 无限AI文案生成" 等,最后一条高亮) */
  benefits?: string[]
  /** 支付方式名(兼容旧用法,单选项静态展示) */
  paymentMethod?: string
  /** 支付方式列表(单选 radio,默认 [{id:'wxpay',name:'微信支付',icon:'微'}]) */
  paymentMethods?: ConfirmPaymentMethod[]
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
  /** 完整支付回调(createPayOrder→微信支付→checkOrderStatus→updateUserVipStatus),待接后端/微信支付 */
  onPay?: () => void
}

const CARD_MAX_WIDTH = 320
const CARD_BORDER_RADIUS = 12
const CARD_PADDING_HORIZONTAL = 24
const CARD_PADDING_VERTICAL = 20

const ICON_BG_SIZE = 48
const ICON_FONT_SIZE = 28

const TITLE_FONT_SIZE = 18
const PRODUCT_NAME_FONT_SIZE = 15
const PRODUCT_PRICE_FONT_SIZE = 13
const MESSAGE_FONT_SIZE = 13

const PRODUCT_ROW_PADDING = 12
const PRODUCT_ROW_BORDER_RADIUS = 8
const PRODUCT_THUMB_SIZE = 48
const PRODUCT_THUMB_BORDER_RADIUS = 8
const PRODUCT_THUMB_EMOJI_SIZE = 24

const BUTTON_HEIGHT = 40
const BUTTON_BORDER_RADIUS = 8
const BUTTON_FONT_SIZE = 14

const RADIO_SIZE = 18
const CHECKBOX_SIZE = 16

const OVERLAY_COLOR = 'rgba(0,0,0,0.5)'

/**
 * 会员金色 #FFD700(任务约定可用)。权益高亮沿用 warning.deep 橙,
 * 更贴近原版 highlight 色 #ff5722;如改纯金可替换为 '#FFD700'。
 */
const DEFAULT_PAYMENT_METHODS: ConfirmPaymentMethod[] = [
  { id: 'wxpay', name: '微信支付', icon: '微' },
]

function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '¥0.00'
  return `¥${price.toFixed(2)}`
}

function formatYuan(price: number): string {
  if (!Number.isFinite(price)) return '0'
  return price % 1 === 0 ? String(price) : price.toFixed(2)
}

export function ConfirmPurchasePopUp({
  visible,
  title,
  message,
  product,
  onCancel,
  onConfirm,
  loading = false,
  cancelText = '取消',
  confirmText = '确认',
  benefits,
  paymentMethod,
  paymentMethods,
  payMethod,
  onPayMethodChange,
  agreementText,
  agreed,
  onAgreeChange,
  onAgreementPress,
  onPay,
}: ConfirmPurchasePopUpProps) {
  const [internalPayMethod, setInternalPayMethod] = useState<string | null>(null)
  const [internalAgreed, setInternalAgreed] = useState(false)

  const payOptions: ConfirmPaymentMethod[] =
    paymentMethods && paymentMethods.length > 0
      ? paymentMethods
      : paymentMethod
        ? [{ id: 'wxpay', name: paymentMethod, icon: '微' }]
        : DEFAULT_PAYMENT_METHODS

  // 仅当调用方显式传入支付方式时才渲染支付方式区,保证旧用法(纯确认框)不被破坏
  const hasPaymentOptions = paymentMethods !== undefined || paymentMethod !== undefined
  const firstPayOption = payOptions.length > 0 ? payOptions[0] : undefined
  const selectedPayMethod = payMethod ?? internalPayMethod ?? firstPayOption?.id
  const hasAgreement = Boolean(agreementText)
  const isAgreed = agreed ?? internalAgreed
  const isMembership = Boolean(
    (benefits && benefits.length > 0) || hasPaymentOptions || hasAgreement,
  )
  const payDisabled = loading || (hasAgreement && !isAgreed)
  const payButtonLabel = isMembership ? `立即支付 ¥${formatYuan(product.price)}` : confirmText

  const selectPayMethod = (methodId: string) => {
    if (payMethod === undefined) setInternalPayMethod(methodId)
    onPayMethodChange?.(methodId)
  }

  const toggleAgree = () => {
    const next = !isAgreed
    if (agreed === undefined) setInternalAgreed(next)
    onAgreeChange?.(next)
  }

  const handlePay = () => {
    if (payDisabled) return
    if (onPay) onPay()
    else onConfirm()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
          accessibilityLabel="关闭弹窗"
        />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText} allowFontScaling={false}>
              ✓
            </Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          <View style={styles.productRow}>
            <View style={styles.productThumb}>
              <Text style={styles.productThumbEmoji} allowFontScaling={false}>
                {product.icon ?? '🛒'}
              </Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>
                {product.name}
              </Text>
              <View style={styles.productPriceRow}>
                <Text style={styles.productPrice} numberOfLines={1}>
                  {formatPrice(product.price)}
                </Text>
                {product.originalPrice && product.originalPrice > product.price ? (
                  <Text style={styles.productPriceOriginal} numberOfLines={1}>
                    {formatPrice(product.originalPrice)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={styles.message}>{message}</Text>

          {/* 权益列表(对齐 Uniapp product-desc benefit-item ✓ 权益,最后一条高亮) */}
          {benefits && benefits.length > 0 ? (
            <View style={styles.benefitsWrap}>
              {benefits.map((b, i) => (
                <Text
                  key={`${b}-${i}`}
                  style={[
                    styles.benefitItem,
                    i === benefits.length - 1 ? styles.benefitHighlight : null,
                  ]}
                >
                  {'✓ '}
                  {b}
                </Text>
              ))}
            </View>
          ) : null}

          {/* 支付方式(对齐 Uniapp payment-options,单选 radio,微信支付) */}
          {hasPaymentOptions ? (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{'支付方式'}</Text>
              {payOptions.map((m) => {
                const active = m.id === selectedPayMethod
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.paymentOption, active ? styles.paymentOptionActive : null]}
                    onPress={() => selectPayMethod(m.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <View style={styles.paymentIcon}>
                      <Text style={styles.paymentIconText} allowFontScaling={false}>
                        {m.icon ?? m.name.charAt(0)}
                      </Text>
                    </View>
                    <Text style={styles.paymentName}>{m.name}</Text>
                    <View style={[styles.radio, active ? styles.radioActive : null]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && !loading ? styles.cancelButtonPressed : null,
              ]}
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && !payDisabled ? styles.confirmButtonPressed : null,
                payDisabled ? styles.confirmButtonDisabled : null,
              ]}
              onPress={handlePay}
              disabled={payDisabled}
              accessibilityRole="button"
              accessibilityLabel={payButtonLabel}
            >
              {loading ? (
                <ActivityIndicator size="small" color={tokens.surface.light} />
              ) : (
                <Text style={styles.confirmButtonText}>{payButtonLabel}</Text>
              )}
            </Pressable>
          </View>

          {/* 协议区(对齐 Uniapp agreement "点击立即支付，表示同意《用户协议》",勾选后启用支付) */}
          {hasAgreement ? (
            <View style={styles.agreementRow}>
              <Pressable
                style={[
                  styles.agreementCheckbox,
                  isAgreed ? styles.agreementCheckboxChecked : null,
                ]}
                onPress={toggleAgree}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAgreed }}
                accessibilityLabel={agreementText}
              >
                {isAgreed ? (
                  <Text style={styles.agreementCheckMark} allowFontScaling={false}>
                    ✓
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                style={styles.agreementTextWrap}
                onPress={onAgreementPress}
                disabled={!onAgreementPress}
              >
                <Text style={styles.agreementText}>{agreementText}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  } as ViewStyle,
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: tokens.surface.card,
    borderRadius: CARD_BORDER_RADIUS,
    paddingHorizontal: CARD_PADDING_HORIZONTAL,
    paddingVertical: CARD_PADDING_VERTICAL,
    alignItems: 'center',
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  } as ViewStyle,
  iconWrap: {
    width: ICON_BG_SIZE,
    height: ICON_BG_SIZE,
    borderRadius: ICON_BG_SIZE / 2,
    backgroundColor: tokens.success.lighter,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  iconText: {
    fontSize: ICON_FONT_SIZE,
    lineHeight: ICON_FONT_SIZE + 2,
    color: tokens.success.DEFAULT,
    fontWeight: '700',
    textAlign: 'center',
  } as TextStyle,
  title: {
    marginTop: 16,
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
  } as TextStyle,
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: tokens.surface.muted,
    borderRadius: PRODUCT_ROW_BORDER_RADIUS,
    padding: PRODUCT_ROW_PADDING,
    marginTop: 16,
  } as ViewStyle,
  productThumb: {
    width: PRODUCT_THUMB_SIZE,
    height: PRODUCT_THUMB_SIZE,
    borderRadius: PRODUCT_THUMB_BORDER_RADIUS,
    backgroundColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  productThumbEmoji: {
    fontSize: PRODUCT_THUMB_EMOJI_SIZE,
    lineHeight: PRODUCT_THUMB_EMOJI_SIZE + 2,
    textAlign: 'center',
  } as TextStyle,
  productInfo: {
    flex: 1,
    marginLeft: 12,
  } as ViewStyle,
  productName: {
    fontSize: PRODUCT_NAME_FONT_SIZE,
    lineHeight: PRODUCT_NAME_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
    gap: 8,
  } as ViewStyle,
  productPrice: {
    fontSize: PRODUCT_PRICE_FONT_SIZE,
    lineHeight: PRODUCT_PRICE_FONT_SIZE + 4,
    color: tokens.success.DEFAULT,
    fontWeight: '500',
  } as TextStyle,
  productPriceOriginal: {
    fontSize: 11,
    lineHeight: 15,
    color: tokens.text.tertiary,
    textDecorationLine: 'line-through',
  } as TextStyle,
  message: {
    width: '100%',
    marginTop: 12,
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_FONT_SIZE + 6,
    color: tokens.text.secondary,
    textAlign: 'center',
  } as TextStyle,
  benefitsWrap: {
    width: '100%',
    marginTop: 12,
    gap: 4,
    alignItems: 'flex-start',
  } as ViewStyle,
  benefitItem: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.text.secondary,
  } as TextStyle,
  benefitHighlight: {
    color: tokens.warning.deep,
    fontWeight: '600',
  } as TextStyle,
  paymentRow: {
    width: '100%',
    marginTop: 12,
  } as ViewStyle,
  paymentLabel: {
    fontSize: 12,
    color: tokens.text.tertiary,
    marginBottom: 6,
  } as TextStyle,
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  } as ViewStyle,
  paymentOptionActive: {
    backgroundColor: tokens.success.lighter,
    borderColor: tokens.success.DEFAULT,
  } as ViewStyle,
  paymentIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: tokens.success.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  paymentIconText: {
    fontSize: 12,
    color: tokens.surface.light,
    fontWeight: '700',
  } as TextStyle,
  paymentName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
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
  agreementRow: {
    width: '100%',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  } as ViewStyle,
  agreementCheckbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  agreementCheckboxChecked: {
    backgroundColor: tokens.success.DEFAULT,
    borderColor: tokens.success.DEFAULT,
  } as ViewStyle,
  agreementCheckMark: {
    fontSize: 11,
    lineHeight: 13,
    color: tokens.surface.light,
    fontWeight: '700',
  } as TextStyle,
  agreementTextWrap: {
    flexShrink: 1,
  } as ViewStyle,
  agreementText: {
    fontSize: 11,
    lineHeight: 16,
    color: tokens.text.tertiary,
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 20,
    gap: 12,
  } as ViewStyle,
  cancelButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  cancelButtonPressed: {
    backgroundColor: tokens.surface.muted,
  } as ViewStyle,
  cancelButtonText: {
    fontSize: BUTTON_FONT_SIZE,
    lineHeight: BUTTON_FONT_SIZE + 2,
    color: tokens.text.primary,
    fontWeight: '500',
  } as TextStyle,
  confirmButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    backgroundColor: tokens.success.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  confirmButtonPressed: {
    backgroundColor: tokens.success.deep,
  } as ViewStyle,
  confirmButtonDisabled: {
    opacity: 0.6,
  } as ViewStyle,
  confirmButtonText: {
    fontSize: BUTTON_FONT_SIZE,
    lineHeight: BUTTON_FONT_SIZE + 2,
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,
})

export default ConfirmPurchasePopUp
