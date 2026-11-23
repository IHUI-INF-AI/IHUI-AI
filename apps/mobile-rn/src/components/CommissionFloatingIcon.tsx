// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CommissionFloatingIcon 佣金悬浮按钮 (mobile-rn 端)
 *
 * 对齐 Uniapp 分销体系中的佣金悬浮按钮:
 * - 固定在右下角的悬浮按钮(absolute bottom-right)
 * - 图标 + 可选金额(¥xxx)；2026-11-23 起「我的佣金」文字标签删除，语义只由 accessibilityLabel 承担
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
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { tokens as tk } from '../theme/active-tokens'
import { Banknote } from 'lucide-react-native'

import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { useI18n } from '../i18n'

export interface CommissionFloatingIconProps {
  amount?: string | number
  onPress: () => void
}

const CONTAINER_PADDING_H = 12
const CONTAINER_PADDING_V = 8
const TEXT_WRAP_MARGIN_LEFT = 6
const AMOUNT_FONT_SIZE = 14
const BOTTOM_OFFSET = 80
const RIGHT_OFFSET = 16
const Z_INDEX = 100

const ICON = Banknote
const CURRENCY = '¥'

export function CommissionFloatingIcon({ amount, onPress }: CommissionFloatingIconProps) {
  const { t } = useI18n()
  const displayAmount =
    amount === undefined ? null : typeof amount === 'number' ? amount.toFixed(2) : amount

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={t('commission.myLabel')}
    >
      <ICON size={18} color={tk.brand.ctaForeground} />
      {/* 金额为空时不渲染包装层：空 View 会留下 6 的左边距，把图标整体推偏。 */}
      {displayAmount !== null ? (
        <Text style={styles.amount} numberOfLines={1}>
          {CURRENCY}
          {displayAmount}
        </Text>
      ) : null}
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
    justifyContent: 'center',
    backgroundColor: tk.brand.cta,
    borderRadius: rnRadius.xl,
    // 纯图标态的高度下限：去掉文字标签后 8+18+8=34 低于 40dp 触控口径
    minHeight: rnSpacing['4xl'],
    paddingHorizontal: CONTAINER_PADDING_H,
    paddingVertical: CONTAINER_PADDING_V,
    zIndex: Z_INDEX,
  } as ViewStyle,
  amount: {
    marginLeft: TEXT_WRAP_MARGIN_LEFT,
    fontSize: AMOUNT_FONT_SIZE,
    fontWeight: '700',
    color: tk.brand.ctaForeground,
  } as TextStyle,
})

export default CommissionFloatingIcon
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
