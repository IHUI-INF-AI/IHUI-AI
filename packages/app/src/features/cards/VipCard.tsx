import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export interface VipCardProps {
  /** VIP 等级 1-9 */
  level: number
  /** 到期时间(ISO 字符串) */
  expireDate: string
  /** 权益列表 */
  benefits: string[]
  /** 自定义等级文案(如"黄金会员",优先于默认"会员尊享"显示) */
  levelName?: string
  /** 剩余天数 */
  daysRemaining?: number
  /** 价格(单位:分,用于购买入口) */
  price?: number
  /** 购买按钮回调(若有 price 则显示按钮) */
  onPurchasePress?: () => void
  /** 底部 slot(用于自定义额外内容) */
  footer?: ReactNode
  onPress?: () => void
  colorScheme?: 'light' | 'dark'
}

const VIP_BG = '#F59E0B'
const VIP_TEXT = '#FFFFFF'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatPrice(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return '¥0.00'
  return `¥${(cents / 100).toFixed(2)}`
}

/**
 * VipCard — VIP 会员卡(跨端共享)。
 *
 * 纯展示组件:等级徽章 + 到期时间 + 权益标签,数据由调用方传入。
 * 样式遵循 packages/app 现有模式(StyleSheet + getTokens),暗色模式经 colorScheme 切换。
 */
export function VipCard({
  level,
  expireDate,
  benefits,
  levelName,
  daysRemaining,
  price,
  onPurchasePress,
  footer,
  onPress,
  colorScheme = 'light',
}: VipCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const safeLevel = Math.max(1, Math.min(9, Math.trunc(level) || 1))
  const visibleBenefits = benefits.slice(0, 4)
  const overflow = benefits.length - visibleBenefits.length
  const showDays =
    typeof daysRemaining === 'number' && Number.isFinite(daysRemaining) && daysRemaining >= 0
  const showPurchase = typeof price === 'number' && Number.isFinite(price) && price >= 0

  const purchaseInner = (
    <Text style={styles.purchaseBtnText}>
      {showPurchase ? `${formatPrice(price as number)} 购买` : '购买'}
    </Text>
  )

  const inner = (
    <Fragment>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.vipBadge}>
            <Text style={styles.vipBadgeText}>{`VIP${safeLevel}`}</Text>
          </View>
          <Text style={styles.title}>{levelName ?? '会员尊享'}</Text>
        </View>
        <View style={styles.expireWrap}>
          {showDays ? <Text style={styles.daysText}>{`剩 ${daysRemaining} 天`}</Text> : null}
          <Text style={styles.expireText}>到期 {formatDate(expireDate)}</Text>
        </View>
      </View>

      {visibleBenefits.length > 0 ? (
        <View style={styles.benefitsWrap}>
          {visibleBenefits.map((b, i) => (
            <View key={`${i}-${b}`} style={styles.benefitTag}>
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
          {overflow > 0 ? (
            <View style={[styles.benefitTag, styles.overflowTag]}>
              <Text style={styles.benefitText}>{`+${overflow}`}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showPurchase ? (
        onPurchasePress ? (
          <Pressable
            style={({ pressed }) => [styles.purchaseBtn, pressed && styles.pressed]}
            onPress={onPurchasePress}
          >
            {purchaseInner}
          </Pressable>
        ) : (
          <View style={styles.purchaseBtn}>{purchaseInner}</View>
        )
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Fragment>
  )

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onPress}
      >
        {inner}
      </Pressable>
    )
  }
  return <View style={styles.card}>{inner}</View>
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    card: { backgroundColor: tk.surface.muted, borderRadius: 8, padding: 16, gap: 12 },
    pressed: { opacity: 0.85 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vipBadge: {
      backgroundColor: VIP_BG,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    vipBadgeText: { color: VIP_TEXT, fontSize: 12, fontWeight: '700' },
    title: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    expireWrap: { alignItems: 'flex-end', gap: 2 },
    daysText: { fontSize: 12, color: VIP_BG, fontWeight: '600' },
    expireText: { fontSize: 12, color: tk.text.secondary },
    benefitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    benefitTag: {
      backgroundColor: tk.surface.card,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    overflowTag: { backgroundColor: 'transparent', borderWidth: 1, borderColor: tk.border.light },
    benefitText: { fontSize: 11, color: tk.text.secondary },
    purchaseBtn: {
      alignSelf: 'flex-start',
      backgroundColor: VIP_BG,
      borderRadius: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    purchaseBtnText: { color: VIP_TEXT, fontSize: 13, fontWeight: '700' },
    footer: { marginTop: 4 },
  })
}
