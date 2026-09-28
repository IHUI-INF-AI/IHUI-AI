// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。
import { rnRadius } from '@ihui/design-tokens'

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
          // 守门 131 那一型:函数形态 style 落在 Pressable 上会被 cssInterop 展开成空对象,
          // 整份内联样式静默消失。按钮盒含底色/圆角(有绘制),整盒下移到子 View 数组形态;
          // alignSelf flex-start 是纯布局档,留在外层槽位;宽度原本由内容决定,不补百分比宽。
          <Pressable style={styles.purchaseBtnSlot} onPress={onPurchasePress}>
            {({ pressed }) => (
              <View style={[styles.purchaseBtn, pressed && styles.pressed]}>{purchaseInner}</View>
            )}
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
      // 同上(守门 131 那一型):卡片盒含底色/描边/圆角(有绘制),整盒下移到子 View;
      // 改前宽度由使用方给定的整行宽撑出,故内层用 cardFace 显式把宽度还给盒子。
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <View style={[styles.cardFace, styles.card, pressed && styles.pressed]}>{inner}</View>
        )}
      </Pressable>
    )
  }
  return <View style={styles.card}>{inner}</View>
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    // 守门 131 转换新增:卡片盒下移到子 View 后,宽度由该档显式还给盒子
    // (改前那一维由使用方整行宽撑出),未引入任何新数字档。
    cardFace: {
      width: '100%',
    },
    // 守门 131 转换新增:购买按钮的外层槽位,只承接 flex-start 这一布局档
    // (数值沿用原 purchaseBtn 内的同一声明,盒子视觉已下移到内层)。
    purchaseBtnSlot: {
      alignSelf: 'flex-start',
    },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    pressed: { opacity: 0.85 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vipBadge: {
      backgroundColor: tk.warning.DEFAULT,
      borderRadius: rnRadius.md,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    vipBadgeText: { color: tk.surface.light, fontSize: 14, fontWeight: '700' },
    title: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    expireWrap: { alignItems: 'flex-end', gap: 4 },
    daysText: { fontSize: 14, color: tk.warning.DEFAULT, fontWeight: '600' },
    expireText: { fontSize: 14, color: tk.text.secondary },
    benefitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    benefitTag: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadius.md,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    overflowTag: { backgroundColor: 'transparent', borderWidth: 1, borderColor: tk.border.light },
    benefitText: { fontSize: 11, color: tk.text.secondary },
    purchaseBtn: {
      alignSelf: 'flex-start',
      backgroundColor: tk.warning.DEFAULT,
      borderRadius: rnRadius.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    purchaseBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '700' },
    footer: { marginTop: 8 },
  })
}
