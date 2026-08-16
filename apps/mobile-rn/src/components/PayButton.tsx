/**
 * PayButton 购买/支付按钮 (mobile-rn 端)
 *
 * 对齐历史项目 components/pay_btn.vue 完整结构:
 * - 购买图标形态(4 种,对齐原 itemData.type):
 *   freeuse  免费使用 / freetime 限时免费 / hasbuy 已购买 / monthly 每月
 * - 通用按钮形态(默认):金额按分→元换算显示 + 点击回调 + 禁用态(原「立即支付 ￥real_price」)。
 * - 支付弹窗不内置:RN 端由 ConfirmPurchasePopUp 承担(避免组件职责重复)。
 * - 浅色优雅风;圆角守门(12);无分割线;类型零 any。
 * 平台特有:依赖 react-native Pressable,不适合共享层。
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

/** 购买图标形态(对齐 Uniapp pay_btn itemData.type) */
export type PayButtonType = 'freeuse' | 'freetime' | 'hasbuy' | 'monthly'

export interface PayButtonProps {
  /** 支付金额(单位:分,对齐后端 PaymentOrder.amount 语义;显示时 / 100 转元) */
  amount: number
  /** 货币符号,默认 ￥(对齐 Uniapp 全角 ￥) */
  currency?: string
  /** 自定义按钮文案;不传则用 `立即支付 ￥X.XX`(对齐 Uniapp「立即支付 ￥real_price」) */
  label?: string
  /** 购买图标形态(对齐 Uniapp 免费使用/限时免费/已购买/每月);传入时覆盖 label 渲染 */
  type?: PayButtonType
  /** 禁用态(对齐 Uniapp loading 时不可点) */
  disabled?: boolean
  /** 请求中(对齐 Uniapp loading,显示转圈并禁用) */
  loading?: boolean
  onPress: () => void
}

/** 购买形态文案与主色。
 *  约束:禁用 purple/indigo,改走 rnLightTokens 语义色
 *  (免费=success 绿 / 限时=danger 红 / 已购买=brand 黑 / 每月=warning 橙)。 */
const TYPE_META: Record<PayButtonType, { text: string; color: string }> = {
  freeuse: { text: '免费使用', color: tokens.success.DEFAULT },
  freetime: { text: '限时免费', color: tokens.danger.DEFAULT },
  hasbuy: { text: '已购买', color: tokens.brand.DEFAULT },
  monthly: { text: '每月', color: tokens.warning.DEFAULT },
}

export function PayButton({
  amount,
  currency = '￥',
  label,
  type,
  disabled,
  loading,
  onPress,
}: PayButtonProps): React.JSX.Element {
  const displayAmount = currency + (amount / 100).toFixed(2)
  const buttonText = label ?? `立即支付 ${displayAmount}`
  const isBlocked = disabled || loading

  if (type) {
    const meta = TYPE_META[type]
    return (
      <Pressable
        style={({ pressed }) => [
          styles.typeButton,
          pressed ? styles.pressed : null,
          isBlocked ? styles.disabled : null,
        ]}
        onPress={onPress}
        disabled={isBlocked}
        accessibilityRole="button"
        accessibilityLabel={meta.text}
      >
        <Text style={[styles.typeText, { color: meta.color }]}>{meta.text}</Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.pressed : null,
        isBlocked ? styles.disabled : null,
      ]}
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={buttonText}
    >
      {loading ? (
        <ActivityIndicator color={tokens.surface.light} />
      ) : (
        <Text style={styles.text}>{buttonText}</Text>
      )}
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
  typeButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.border.light,
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
  typeText: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,
})

export default PayButton
