// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'

import { rnRadiusFor } from '@ihui/design-tokens'

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

/** 购买形态文案键与主色。
 *  约束:禁用 purple/indigo,改走 主题 token 入口 语义色
 *  (免费=success 绿 / 限时=danger 红 / 已购买=brand 黑 / 每月=warning 橙)。
 *  文案走词表键(五语齐)而非字面量 —— 本组件由 PaymentScreen 直接挂载,
 *  写死中文会让 RN 付费按钮在四种非中文语言下永远是中文。 */
const TYPE_META: Record<PayButtonType, { textKey: string; color: string }> = {
  freeuse: { textKey: 'payment.payType.freeuse', color: tokens.success.DEFAULT },
  freetime: { textKey: 'payment.payType.freetime', color: tokens.danger.DEFAULT },
  hasbuy: { textKey: 'payment.payType.hasbuy', color: tokens.brand.cta },
  monthly: { textKey: 'payment.payType.monthly', color: tokens.warning.DEFAULT },
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
  const { t } = useI18n()
  const displayAmount = currency + (amount / 100).toFixed(2)
  const buttonText = label ?? `${t('payment.payNow')} ${displayAmount}`
  const isBlocked = disabled || loading

  if (type) {
    const meta = TYPE_META[type]
    const typeText = t(meta.textKey)
    return (
      // 动态按压态/禁用态不得写成函数形态的 style:Pressable 被 cssInterop 注册过,函数声明会被
      // 展开成空对象而整份内联样式静默消失(守门 131 立项那一型)。外层裸 Pressable 只承接点击与
      // 无障碍语义,带底色/描边/圆角的按钮盒整体下移到子 View 的数组形态上;盒子留外层会把描边挤到
      // padding 内圈,所以必须整盒下移,并用撑满档把原来由父级 stretch 给出的宽度还给盒子。
      <Pressable
        onPress={onPress}
        disabled={isBlocked}
        accessibilityRole="button"
        accessibilityLabel={typeText}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.face,
              styles.typeButton,
              pressed ? styles.pressed : null,
              isBlocked ? styles.disabled : null,
            ]}
          >
            <Text style={[styles.typeText, { color: meta.color }]}>{typeText}</Text>
          </View>
        )}
      </Pressable>
    )
  }

  return (
    // 同上(守门 131 那一型):函数形态的 style 落在 Pressable 上会被整份丢掉,故外层只承接交互,
    // 按钮盒与其按压/禁用态落到子 View 的数组形态上,宽度由撑满档保持原来的"整行宽"外观。
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={buttonText}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            styles.button,
            pressed ? styles.pressed : null,
            isBlocked ? styles.disabled : null,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={tokens.brand.ctaForeground} />
          ) : (
            <Text style={styles.text}>{buttonText}</Text>
          )}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // 下移到子 View 的盒子用这一档取回原来由父级 stretch 给出的整行宽;不是新的尺寸档。
  face: { width: '100%' } as ViewStyle,
  button: {
    height: 50,
    // 角色档 control(按钮)→ sm(4),与 web @ihui/ui-react Button 基座同档
    borderRadius: rnRadiusFor.control,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  typeButton: {
    height: 50,
    // 角色档 control(购买形态按钮)→ sm(4)
    borderRadius: rnRadiusFor.control,
    backgroundColor: tokens.surface.card,
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
    color: tokens.brand.ctaForeground,
  } as TextStyle,
  typeText: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,
})

export default PayButton
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
