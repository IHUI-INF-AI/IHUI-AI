/**
 * CommissionFloatingIcon 佣金悬浮按钮 (mobile-rn 端)
 *
 * 对齐 Uniapp 分销体系中的佣金悬浮按钮:
 * - 固定在右下角的悬浮按钮(absolute bottom-right)
 * - 显示"我的佣金"标签 + 可选金额(¥xxx)
 * - 点击 → onPress(由父级跳转分销页)
 * - 浅色优雅风,品牌色填充,圆角矩形(非圆形)
 * - 无霓虹无渐变,系统字体
 *
 * 任务规格:
 *   interface CommissionFloatingIconProps { amount?: string | number; onPress: () => void }
 */
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export interface CommissionFloatingIconProps {
  amount?: string | number
  onPress: () => void
}

const CONTAINER_RADIUS = 12
const CONTAINER_PADDING_H = 12
const CONTAINER_PADDING_V = 8
const TEXT_WRAP_MARGIN_LEFT = 6
const ICON_FONT_SIZE = 18
const LABEL_FONT_SIZE = 10
const AMOUNT_FONT_SIZE = 14
const AMOUNT_MARGIN_TOP = 2
const BOTTOM_OFFSET = 80
const RIGHT_OFFSET = 16
const Z_INDEX = 100

const ICON = '💰'
const LABEL = '我的佣金'
const CURRENCY = '¥'

export function CommissionFloatingIcon({ amount, onPress }: CommissionFloatingIconProps) {
  const displayAmount =
    amount === undefined ? null : typeof amount === 'number' ? amount.toFixed(2) : amount

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={LABEL}
    >
      <Text style={styles.icon} allowFontScaling={false}>
        {ICON}
      </Text>
      <View style={styles.textWrap}>
        <Text style={styles.label} numberOfLines={1}>
          {LABEL}
        </Text>
        {displayAmount !== null ? (
          <Text style={styles.amount} numberOfLines={1}>
            {CURRENCY}
            {displayAmount}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: RIGHT_OFFSET,
    bottom: BOTTOM_OFFSET,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tk.brand.DEFAULT,
    borderRadius: CONTAINER_RADIUS,
    paddingHorizontal: CONTAINER_PADDING_H,
    paddingVertical: CONTAINER_PADDING_V,
    zIndex: Z_INDEX,
  } as ViewStyle,
  icon: {
    fontSize: ICON_FONT_SIZE,
  } as TextStyle,
  textWrap: {
    marginLeft: TEXT_WRAP_MARGIN_LEFT,
  } as ViewStyle,
  label: {
    fontSize: LABEL_FONT_SIZE,
    color: tk.surface.light,
    opacity: 0.85,
  } as TextStyle,
  amount: {
    marginTop: AMOUNT_MARGIN_TOP,
    fontSize: AMOUNT_FONT_SIZE,
    fontWeight: '700',
    color: tk.surface.light,
  } as TextStyle,
})

export default CommissionFloatingIcon
