/**
 * ConfirmPurchasePopUp 确认购买弹窗(mobile-rn 端)
 *
 * 对齐历史项目 ConfirmPurchasePopUp:
 * - Modal 居中弹窗,透明背景 + 半透明黑色遮罩(rgba(0,0,0,0.5))
 * - 卡片:maxWidth 320,圆角 12,内边距 24/20,surface.card 浅灰底
 * - 顶部:48×48 圆形图标(success.lighter 背景 + 居中 ✓,success.DEFAULT 颜色)
 * - 标题:18/600/text.primary,居中,marginTop 16
 * - 商品信息行:surface.muted 圆角 8 容器 + 商品图(emoji)+ 名/价
 * - 描述:13/text.secondary,居中,marginTop 12
 * - 按钮行:取消(描边 surface.card 底) + 确认(success.DEFAULT 底)
 * - 浅色优雅风,无渐变无霓虹,系统字体
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
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

const OVERLAY_COLOR = 'rgba(0,0,0,0.5)'

function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '¥0.00'
  return `¥${price.toFixed(2)}`
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
}: ConfirmPurchasePopUpProps) {
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
              <Text style={styles.productPrice} numberOfLines={1}>
                {formatPrice(product.price)}
              </Text>
            </View>
          </View>

          <Text style={styles.message}>{message}</Text>

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
                pressed && !loading ? styles.confirmButtonPressed : null,
                loading ? styles.confirmButtonDisabled : null,
              ]}
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              {loading ? (
                <ActivityIndicator size="small" color={tokens.surface.light} />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
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
  productPrice: {
    marginTop: 2,
    fontSize: PRODUCT_PRICE_FONT_SIZE,
    lineHeight: PRODUCT_PRICE_FONT_SIZE + 4,
    color: tokens.success.DEFAULT,
    fontWeight: '500',
  } as TextStyle,
  message: {
    width: '100%',
    marginTop: 12,
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_FONT_SIZE + 6,
    color: tokens.text.secondary,
    textAlign: 'center',
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
