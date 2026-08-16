/**
 * PayButton 支付按钮(mobile-rn 端)
 *
 * 对齐历史 Uniapp components/pay_btn.vue 的「立即支付」按钮(行 53-57):
 *   <view class="b_f"><text>立即支付</text><text>￥</text><text>{{ real_price }}</text></view>
 *
 * 统一支付按钮组件:金额按分→元换算显示 + 点击回调 + 禁用态。
 * 浅色优雅风;圆角守门(8,无 rounded-full);无分割线;类型零 any。
 */
import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface PayButtonProps {
  /** 支付金额(单位:分,对齐后端 PaymentOrder.amount 语义;显示时 / 100 转元) */
  amount: number
  /** 货币符号,默认 ¥(对齐 Uniapp ￥) */
  currency?: string
  /** 自定义按钮文案;不传则用 `支付 ¥X.XX`(对齐 Uniapp「立即支付 ￥real_price」) */
  label?: string
  /** 禁用态(对齐 Uniapp loading 时不可点) */
  disabled?: boolean
  onPress: () => void
}

export function PayButton({
  amount,
  currency = '¥',
  label,
  disabled,
  onPress,
}: PayButtonProps): React.JSX.Element {
  const displayAmount = currency + (amount / 100).toFixed(2)
  const buttonText = label ?? `支付 ${displayAmount}`
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={buttonText}
    >
      <Text style={styles.text}>{buttonText}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  pressed: { opacity: 0.85 } as ViewStyle,
  disabled: { opacity: 0.5 } as ViewStyle,
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.surface.light,
  } as TextStyle,
})

export default PayButton
